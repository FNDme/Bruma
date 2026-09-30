import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  STORAGE_KEYS,
  isRecord,
  isString,
  readJson,
  writeJson,
} from "@/lib/storage";

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

function isUserCredentials(value: unknown): value is UserCredentials {
  return (
    isRecord(value) && isString(value.userName) && isString(value.userEmail)
  );
}

const UserCredentialsContext = createContext<
  UserCredentialsContextType | undefined
>(undefined);

export function UserCredentialsProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<UserCredentials>(() =>
    // Load credentials from localStorage on initialization
    readJson(STORAGE_KEYS.userCredentials, defaultCredentials, isUserCredentials)
  );

  const setCredentials = useCallback((newCredentials: UserCredentials) => {
    writeJson(STORAGE_KEYS.userCredentials, newCredentials);
    setCredentialsState(newCredentials);
  }, []);

  const value = useMemo(
    () => ({ credentials, setCredentials }),
    [credentials, setCredentials]
  );

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
