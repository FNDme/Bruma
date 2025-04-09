import { createContext, useContext, useState, ReactNode } from "react";

interface UserCredentials {
  userName: string;
  userEmail: string;
}

interface UserCredentialsContextType {
  credentials: UserCredentials;
  setCredentials: (credentials: UserCredentials) => void;
}

const defaultCredentials: UserCredentials = {
  userName: "",
  userEmail: "",
};

const UserCredentialsContext = createContext<
  UserCredentialsContextType | undefined
>(undefined);

export function UserCredentialsProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<UserCredentials>(() => {
    // Try to load credentials from localStorage on initialization
    const savedCredentials = localStorage.getItem("userCredentials");
    return savedCredentials ? JSON.parse(savedCredentials) : defaultCredentials;
  });

  const value = {
    credentials,
    setCredentials: (newCredentials: UserCredentials) => {
      localStorage.setItem("userCredentials", JSON.stringify(newCredentials));
      setCredentials(newCredentials);
    },
  };

  return (
    <UserCredentialsContext.Provider value={value}>
      {children}
    </UserCredentialsContext.Provider>
  );
}

export const useUserCredentials = () => {
  const context = useContext(UserCredentialsContext);
  if (context === undefined) {
    throw new Error(
      "useUserCredentials must be used within a UserCredentialsProvider"
    );
  }
  return context;
};
