export default function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Welcome to <span className="font-alfa tracking-wide">Bruma</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Your personal space for whatever you want
          </p>
        </div>
      </div>
    </div>
  );
}
