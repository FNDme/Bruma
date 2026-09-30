//! Runs external commands with a timeout, so a hung PowerShell or gsettings
//! can never keep a check "running" forever.
#![cfg_attr(not(any(target_os = "macos", target_os = "windows", target_os = "linux")), allow(dead_code))]

use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

/// Per-command limit. PowerShell can take several seconds to start cold.
pub const COMMAND_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug)]
pub struct CommandOutput {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

impl CommandOutput {
    /// stdout and stderr together, for tools that write their answer to stderr
    pub fn combined(&self) -> String {
        format!("{}\n{}", self.stdout, self.stderr)
    }
}

pub fn run(program: &str, args: &[&str]) -> Result<CommandOutput, String> {
    run_with_timeout(program, args, COMMAND_TIMEOUT)
}

/// Like [`run`], but a non-zero exit status is an error that includes the
/// first line of stderr.
pub fn run_ok(program: &str, args: &[&str]) -> Result<CommandOutput, String> {
    let output = run(program, args)?;
    if output.success {
        return Ok(output);
    }
    let reason = output
        .stderr
        .lines()
        .chain(output.stdout.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("no error message");
    let code = output
        .code
        .map(|c| format!("exit code {c}"))
        .unwrap_or_else(|| "terminated".to_string());
    Err(format!("{program} failed ({code}): {reason}"))
}

fn spawn_reader<R: Read + Send + 'static>(source: Option<R>) -> mpsc::Receiver<Vec<u8>> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(mut source) = source {
            let _ = source.read_to_end(&mut buffer);
        }
        let _ = tx.send(buffer);
    });
    rx
}

fn kill(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

pub fn run_with_timeout(
    program: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<CommandOutput, String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => {
            format!("could not run {program}: it is not installed or not on PATH")
        }
        _ => format!("could not run {program}: {e}"),
    })?;

    // Read both pipes concurrently so a chatty command cannot fill a pipe
    // buffer and block forever.
    let stdout_rx = spawn_reader(child.stdout.take());
    let stderr_rx = spawn_reader(child.stderr.take());

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                kill(&mut child);
                return Err(format!(
                    "{program} did not finish within {} seconds",
                    timeout.as_secs_f32()
                ));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => {
                kill(&mut child);
                return Err(format!("could not wait for {program}: {e}"));
            }
        }
    };

    // A grandchild may keep a pipe open after the command exits; do not wait
    // for it indefinitely.
    let grace = deadline
        .saturating_duration_since(Instant::now())
        .max(Duration::from_millis(500));
    let stdout = stdout_rx.recv_timeout(grace).unwrap_or_default();
    let stderr = stderr_rx
        .recv_timeout(Duration::from_millis(500))
        .unwrap_or_default();

    Ok(CommandOutput {
        success: status.success(),
        code: status.code(),
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn captures_output_and_status() {
        let output = run("sh", &["-c", "echo out; echo err >&2; exit 3"]).unwrap();
        assert!(!output.success);
        assert_eq!(output.code, Some(3));
        assert_eq!(output.stdout.trim(), "out");
        assert_eq!(output.stderr.trim(), "err");

        let error = run_ok("sh", &["-c", "echo boom >&2; exit 2"]).unwrap_err();
        assert!(error.contains("exit code 2"), "{error}");
        assert!(error.contains("boom"), "{error}");
    }

    #[test]
    fn kills_commands_that_hang() {
        let started = Instant::now();
        let error = run_with_timeout("sleep", &["10"], Duration::from_millis(200)).unwrap_err();
        assert!(error.contains("did not finish"), "{error}");
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn reports_missing_programs() {
        let error = run("bruma-definitely-not-a-real-command", &[]).unwrap_err();
        assert!(error.contains("not installed"), "{error}");
    }
}
