'use client'
import { useEffect, useState } from "react"

export default function Splash() {
  const [show, setShow] = useState(true)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 900)
    const hideTimer = setTimeout(() => setShow(false), 1300)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  if (!show) return null
  return (
    <div className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-400 ${fade ? "opacity-0" : "opacity-100"}`}>
      <img src="/6A7BBAE9-3193-46CC-A8E4-03EE313FABD5.png" alt="Airalance" className="w-40 animate-logoPulse" />
    </div>
  )
}
