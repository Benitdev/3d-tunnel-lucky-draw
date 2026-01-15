import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"
import { useGoogleLogin, googleLogout } from "@react-oauth/google"

interface GoogleUser {
  sub: string // Google user ID
  name: string
  email: string
  picture: string
}

interface GoogleAuthContextType {
  user: GoogleUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => void
  userName: string | null
  authError: string | null
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(
  undefined
)

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext)
  if (!context) {
    throw new Error("useGoogleAuth must be used within GoogleAuthProvider")
  }
  return context
}

interface GoogleAuthProviderProps {
  children: ReactNode
}

export const GoogleAuthProvider: React.FC<GoogleAuthProviderProps> = ({
  children,
}) => {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  // Get allowed domain from environment variable (e.g., "company.com")
  // Leave empty to allow all domains
  const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_GOOGLE_DOMAIN || ""

  // Validate email domain
  const validateDomain = (email: string): boolean => {
    if (!ALLOWED_DOMAIN) {
      // No domain restriction set, allow all
      return true
    }

    const emailDomain = email.split("@")[1]?.toLowerCase()
    const allowedDomain = ALLOWED_DOMAIN.toLowerCase().replace(/^@/, "") // Remove @ if present

    return emailDomain === allowedDomain
  }

  // Check for stored user info on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("google_user")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        // Validate domain on mount if restriction is set
        if (ALLOWED_DOMAIN && !validateDomain(parsedUser.email)) {
          // Domain doesn't match, clear stored user
          localStorage.removeItem("google_user")
          localStorage.removeItem("google_access_token")
          setUser(null)
          setAuthError(`Access restricted to ${ALLOWED_DOMAIN} accounts only.`)
        } else {
          setUser(parsedUser)
        }
      } catch (error) {
        console.error("Error parsing stored user:", error)
        localStorage.removeItem("google_user")
        localStorage.removeItem("google_access_token")
      }
    }
    setIsLoading(false)
  }, [])

  // Fetch user profile after login
  const fetchUserProfile = async (accessToken: string) => {
    try {
      setAuthError(null) // Clear any previous errors
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`
      )
      if (response.ok) {
        const userInfo = await response.json()

        // Validate domain if restriction is set
        if (ALLOWED_DOMAIN && !validateDomain(userInfo.email)) {
          const errorMessage = `Access restricted to ${ALLOWED_DOMAIN} accounts only. Your email (${userInfo.email}) is not from the allowed organization.`
          setAuthError(errorMessage)
          console.error("Domain validation failed:", errorMessage)
          // Clear any stored data
          localStorage.removeItem("google_user")
          localStorage.removeItem("google_access_token")
          setUser(null)
          return
        }

        const userData: GoogleUser = {
          sub: userInfo.sub,
          name: userInfo.name || userInfo.email,
          email: userInfo.email,
          picture: userInfo.picture || "",
        }
        setUser(userData)
        setAuthError(null) // Clear any previous errors
        localStorage.setItem("google_user", JSON.stringify(userData))
        localStorage.setItem("google_access_token", accessToken)
      } else {
        // Token might be expired, clear stored data
        const errorMessage = "Failed to fetch user profile. Please try again."
        setAuthError(errorMessage)
        localStorage.removeItem("google_user")
        localStorage.removeItem("google_access_token")
        setUser(null)
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      const errorMessage =
        "An error occurred during authentication. Please try again."
      setAuthError(errorMessage)
      // Clear on error
      localStorage.removeItem("google_user")
      localStorage.removeItem("google_access_token")
      setUser(null)
    }
  }

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      fetchUserProfile(tokenResponse.access_token)
    },
    onError: (error) => {
      console.error("Login failed:", error)
      setAuthError("Login failed. Please try again.")
    },
    // Restrict to specific domain if set (only works for Google Workspace domains)
    ...(ALLOWED_DOMAIN && { hosted_domain: ALLOWED_DOMAIN.replace(/^@/, "") }),
  })

  const logout = () => {
    googleLogout()
    setUser(null)
    setAuthError(null)
    localStorage.removeItem("google_user")
    localStorage.removeItem("google_access_token")
  }

  const value: GoogleAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    userName: user?.name || null,
    authError,
  }

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  )
}
