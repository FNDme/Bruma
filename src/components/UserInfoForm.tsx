import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUserCredentials } from "@/contexts/UserCredentialsContext";

export function UserInfoForm() {
  const { credentials, setCredentials } = useUserCredentials();
  const [userFullName, setUserFullName] = useState(credentials.userName);
  const [userEmail, setUserEmail] = useState(credentials.userEmail);

  const hasChanges =
    userFullName !== credentials.userName ||
    userEmail !== credentials.userEmail;

  return (
    <form
      onSubmit={() => {
        setCredentials({ userName: userFullName, userEmail: userEmail });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={userFullName}
          onChange={(e) => setUserFullName(e.target.value)}
          placeholder="Enter your name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />
      </div>
      <Button type="submit" disabled={!hasChanges}>
        {hasChanges ? "Save Credentials" : "No changes"}
      </Button>
    </form>
  );
}
