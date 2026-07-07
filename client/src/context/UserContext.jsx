import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '../API.js';


const UserContext = createContext(null);

function UserProvider({ children }) {
  const [user, setUser] = useState(null);         // null = not checked yet, false = not logged in
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch {
        setUser(false);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

function useUser() {
  return useContext(UserContext);
}


export {
  UserProvider,
  useUser
}
