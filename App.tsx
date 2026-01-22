import gsap from "gsap"
import React, { useEffect, useState } from "react"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { GoogleAuthProvider } from "./utils/googleAuth"
import ImageSlider from "@/components/ImageSlider"

const isDarkMode = true
const App: React.FC = () => {
  useEffect(() => {
    // Global GSAP settings
    gsap.config({
      autoSleep: 60,
      force3D: true,
    })
  }, [])

  // Get Google Client ID from environment variable
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

  if (!googleClientId) {
    console.warn(
      "VITE_GOOGLE_CLIENT_ID is not set. Please add it to your .env file."
    )
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <GoogleAuthProvider>
        <div
          className={`min-h-screen transition-colors duration-700 ${
            isDarkMode
              ? "bg-[#050505] text-white selection:bg-orange-900 selection:text-orange-100"
              : "bg-white text-slate-900 selection:bg-orange-100 selection:text-orange-900"
          } overflow-hidden`}
        >
          {/* <Navigation isDarkMode={isDarkMode} toggleTheme={toggleTheme} /> */}
          <main>
          <ImageSlider isDarkMode={true} />
          </main>

          {/* Footer fixed at bottom right or hidden for infinite feel */}
          <footer
            className={`fixed bottom-4 right-6 text-[10px] pointer-events-none z-50 transition-colors duration-500 ${
              isDarkMode ? "text-white/30" : "text-black/30"
            }`}
          >
            <p>&copy; {new Date().getFullYear()} Kozocom </p>
          </footer>
        </div>
      </GoogleAuthProvider>
    </GoogleOAuthProvider>
  )
}

export default App
