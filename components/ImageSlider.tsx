import gsap from "gsap"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface ImageSliderProps {
  images?: string[]
  isDarkMode?: boolean
}

interface ImageInfo {
  image: string
  actor: string
  description: string
}

const IMAGES_INFO: ImageInfo[] = [
  {
    image: "/images/Anh du thi Kozocom - Thi Thao Trinh Nguyen.jpg",
    actor: "Nguyễn Thị Thảo Trinh",
    description: "Hoạt động ngày thành lập công đoàn\n労働組合の設立日の活動",
  },
  {
    image: "/images/IMG_8273 - Thao Bui Duy.jpg",
    actor: "Bùi Duy Thảo",
    description:
      "Kozocom Badminton Club - Gắn kết vượt thời gian\nKozocom Badminton Club - 同僚との強い結び",
  },
  {
    image: "/images/IMG_20251208_102343 - Mai Ho Thi Quynh.jpg",
    actor: "Hồ Thị Quỳnh Mai",
    description:
      "Sự chăm chỉ hôm nay của những Entry chính là nền móng cho thành công ngày mai\nEntryメンバー一人ひとりの今日の努力こそが、将来の成功を築く基盤",
  },
  {
    image: "/images/IMG_9848 - Nhan Nguyen Trong.jpg",
    actor: "Nguyễn Trọng Nhân",
    description: "Kozocom Panorama",
  },
  {
    image: "/images/IMG_5096 - Thanh Bui Van.jpg",
    actor: "Bùi Văn Thành",
    description:
      'Một ngày "rất bình thường" của Team TAS\nTASチームのごく平凡な一日',
  },
  {
    image: "/images/IMG_7077 - Giang Le Thi.jpg",
    actor: "Lê Thị Giang",
    description: "Tắt thở nơi công sở\n職場でエネルギー切れ",
  },
  {
    image: "/images/IMG_3001 - Khoa Nguyen Nhat.jpg",
    actor: "Khoa Nguyễn",
    description: "Mối tình trung học năm ấy\n忘れられない高校時代の恋",
  },
  {
    image: "/images/IMG_3145 - Nhan Phan Duc.jpg",
    actor: "Phan Đức Nhân",
    description:
      "Lớn Rồi Vẫn Thích Quà Trung Thu\n大人になってもこどもの日のプレゼントが好き",
  },
  {
    image: "/images/IMG_20260116_115321 - Vi Pham Thi.jpg",
    actor: "Phạm Thị Vi",
    description: "Hơn cả đồng nghiệp\n同僚以上の関係",
  },
  {
    image: "/images/TẾT 2025 - Ly Tran Thi Khanh.jpg",
    actor: "Trần Thị Khánh Ly",
    description:
      "Khi nam thần tạm nghỉ, niềm vui lên ngôi\nイケメンのイメージを忘れて、笑いが主役",
  },
  {
    image: "/images/IMG_5937 - Thanh Tran Chi.jpg",
    actor: "Trần Chí Thành",
    description: "Vegekul - Business Trip",
  },
  {
    image: "/images/20250917_084416 - Hau Ha Minh.jpg",
    actor: "Hà Minh Hậu",
    description: "Team mate & Client",
  },
  {
    image: "/images/IMG_6444 - Hoai Tran Thi Thu.jpg",
    actor: "Trần Thị Thu Hoài",
    description:
      "Kozocom - Nơi Câu Chuyện Bắt Đầu\nKozocom - 物語が始まった場所",
  },
  {
    image: "/images/IMG_1886 - Van Hoang Thi Cam.jpg",
    actor: "Hoàng Thị Cẩm Vân",
    description:
      "Chung Nhịp Cười Dưới Ánh Đèn Đêm\nライトアップの下、笑顔が重なる瞬間",
  },
]

const ImageSlider: React.FC<ImageSliderProps> = ({
  images,
  isDarkMode = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentImageRef = useRef<HTMLImageElement>(null)
  const nextImageRef = useRef<HTMLImageElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const isTransitioningRef = useRef(false)
  const currentIndexRef = useRef(0)
  const winnerTimerSetRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const shownInFirstCycleRef = useRef<Set<number>>(new Set())
  const isFirstCycleCompleteRef = useRef(false)
  const recapModeStartTimeRef = useRef<number | null>(null)
  const recapModeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shownInRecapRef = useRef<Set<number>>(new Set())
  const recapStartIndexRef = useRef<number | null>(null)
  const isRecapCompleteRef = useRef(false)
  const isWinnerRevealedRef = useRef(false) // Synchronous ref to track winner state
  const isStoppedRef = useRef(false) // Synchronous ref to track stopped state
  const initialDelayCompleteRef = useRef(false) // Track if initial 5-second delay has passed

  // State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [currentImageInfo, setCurrentImageInfo] = useState<ImageInfo>(
    IMAGES_INFO[0]
  )
  const [isStopped, setIsStopped] = useState(false)
  const [isWinnerRevealed, setIsWinnerRevealed] = useState(false)
  const [isFastRecapMode, setIsFastRecapMode] = useState(false)
  const [initialDelayComplete, setInitialDelayComplete] = useState(false)
  const [recapPhase, setRecapPhase] = useState<"grid" | "flash" | "winner">("grid")
  const [flashingImages, setFlashingImages] = useState<number[]>([])

  // Use provided images or default to IMAGES_INFO
  const imageList = useMemo(
    () =>
      images
        ? images.map((img) => ({ image: img, actor: "", description: "" }))
        : IMAGES_INFO,
    [images]
  )

  // Image display duration (3 seconds for normal, faster for recap mode)
  const NORMAL_IMAGE_DURATION = 3000
  // Memory Recap Mode: 0.3-0.5s per image (randomized for dynamic feel)
  const getFastRecapDuration = () => 100 + Math.random() * 200
  // Transition duration (faster in recap mode)
  const NORMAL_TRANSITION_DURATION = 1.5
  const FAST_RECAP_TRANSITION_DURATION = 0.3 // Faster transitions in recap mode
  const TRANSITION_DURATION = isFastRecapMode
    ? FAST_RECAP_TRANSITION_DURATION
    : NORMAL_TRANSITION_DURATION
  // Initial delay before starting slideshow (5 seconds)
  const INITIAL_DELAY_MS = 5000
  // Find index of winner image
  const WINNER_INDEX = useMemo(() => {
    const index = imageList.findIndex(
      (img) => img.actor === "Trần Thị Khánh Ly"
    )
    console.log(
      `Winner index calculated: ${index}, Total images: ${imageList.length}`
    )
    if (index >= 0) {
      console.log(`Winner image path: ${imageList[index].image}`)
    }
    return index
  }, [imageList])

  // Transition to next image - CSS-based, smooth and performant
  const transitionToNext = useCallback(
    async (nextIndex: number, isWinnerTransition = false) => {
      // CRITICAL: Stop all transitions if winner is already revealed (unless this IS the winner transition)
      // Check both state and ref for immediate blocking
      if (
        (isWinnerRevealed || isWinnerRevealedRef.current) &&
        !isWinnerTransition
      ) {
        console.log(
          "Winner already revealed, blocking transition - isWinnerRevealed:",
          isWinnerRevealed,
          "ref:",
          isWinnerRevealedRef.current
        )
        return
      }

      if ((isStopped || isStoppedRef.current) && !isWinnerTransition) {
        console.log("Slideshow stopped, blocking transition")
        return
      }

      // Validate index first
      if (nextIndex < 0 || nextIndex >= imageList.length) {
        console.warn(
          `Invalid transition index: ${nextIndex}, imageList length: ${imageList.length}`
        )
        return
      }

      // If this is a winner transition, ensure we're using the correct winner index
      if (isWinnerTransition) {
        if (WINNER_INDEX === -1) {
          console.error("Winner index not found! Cannot transition to winner.")
          return
        }
        if (nextIndex !== WINNER_INDEX) {
          console.warn(
            `Winner transition requested but nextIndex (${nextIndex}) doesn't match WINNER_INDEX (${WINNER_INDEX}). Correcting to WINNER_INDEX.`
          )
          // Correct the index to the actual winner index
          nextIndex = WINNER_INDEX
        }
        const winnerImageInfo = imageList[nextIndex]
        console.log(
          `Winner transition confirmed: index ${nextIndex}, actor: ${winnerImageInfo.actor}, image: ${winnerImageInfo.image}`
        )

        // CRITICAL: Set refs IMMEDIATELY when winner transition starts (not waits for completion)
        // This prevents any other transitions from starting
        isWinnerRevealedRef.current = true
        isStoppedRef.current = true

        // IMMEDIATELY stop all intervals/timeouts
        if (intervalRef.current) {
          if (isFastRecapMode) {
            clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
          } else {
            clearInterval(intervalRef.current)
          }
          intervalRef.current = null
        }

        // Clear recap mode timer if it exists
        if (recapModeTimerRef.current) {
          clearTimeout(recapModeTimerRef.current)
          recapModeTimerRef.current = null
        }
      }

      if (isTransitioningRef.current) {
        console.warn("Already transitioning, skipping this transition")
        return
      }

      isTransitioningRef.current = true
      setIsTransitioning(true)

      const nextImageInfo = imageList[nextIndex]
      // Only treat as winner transition when explicitly triggered by timer (isWinnerTransition = true)
      // During normal cycling, treat winner image like any other image
      const isWinner = isWinnerTransition && nextIndex === WINNER_INDEX
      const currentImg = currentImageRef.current
      const nextImg = nextImageRef.current

      if (!currentImg || !nextImg) {
        isTransitioningRef.current = false
        setIsTransitioning(false)
        return
      }

      // Preload next image
      const img = new Image()
      img.src = nextImageInfo.image
      await new Promise((resolve) => {
        if (img.complete) {
          resolve(null)
        } else {
          img.onload = () => resolve(null)
          img.onerror = () => resolve(null) // Continue even if image fails
        }
      })

      // Set next image source
      nextImg.src = nextImageInfo.image
      nextImg.style.display = "block"

      // Set up 3D perspective on images
      currentImg.style.transformStyle = "preserve-3d"
      nextImg.style.transformStyle = "preserve-3d"

      // Random 3D rotation direction for variety
      const rotationDirection = Math.random() > 0.5 ? 1 : -1

      // More dynamic movement in Memory Recap Mode
      let rotationY, rotationX, xMovement, zMovement
      if (isFastRecapMode) {
        // Memory Recap Mode: More dynamic horizontal/depth movement (like flipping memories)
        rotationY = rotationDirection * (25 + Math.random() * 35) // 25-60 degrees
        rotationX = (Math.random() - 0.5) * 15 // More vertical rotation
        xMovement = rotationDirection * (50 + Math.random() * 100) // Horizontal flip movement
        zMovement = -300 - Math.random() * 200 // More depth movement
      } else {
        // Normal mode: Subtle movement
        rotationY = rotationDirection * (15 + Math.random() * 20)
        rotationX = (Math.random() - 0.5) * 10
        xMovement = 0
        zMovement = -200
      }

      // Exit animation for current image - 3D flip out with enhanced shadow
      gsap.to(currentImg, {
        opacity: 0,
        scale: isFastRecapMode ? 0.75 : 0.85,
        y: isFastRecapMode ? -20 : -30,
        x: isFastRecapMode ? -xMovement * 0.6 : 0,
        rotationY: -rotationY * (isFastRecapMode ? 0.9 : 0.8),
        rotationX: rotationX * (isFastRecapMode ? 0.9 : 0.8),
        z: zMovement,
        filter: isFastRecapMode
          ? "blur(6px) brightness(0.6)"
          : "blur(8px) brightness(0.7)",
        boxShadow: "0 10px 20px -5px rgba(0, 0, 0, 0.3)",
        duration: TRANSITION_DURATION,
        ease: isFastRecapMode ? "power1.inOut" : "power2.in", // Faster easing in recap mode
      })

      // Entrance animation for next image
      if (isWinner) {
        // Special dramatic 3D entrance for winner - only when triggered by timer
        nextImg.style.opacity = "0"
        nextImg.style.transform =
          "scale(0.8) translateY(40px) translateZ(-300px) rotateY(30deg) rotateX(-10deg)"
        nextImg.style.filter = "blur(10px) brightness(0.5)"

        gsap.to(nextImg, {
          opacity: 1,
          scale: 1.05,
          y: 0,
          z: 0,
          rotationY: 0,
          rotationX: 0,
          filter: "blur(0px) brightness(1)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05), 0 0 60px rgba(255, 215, 0, 0.3)",
          duration: NORMAL_TRANSITION_DURATION * 1.3, // Always use normal duration for winner
          ease: "back.out(2)",
          onComplete: () => {
            console.log(
              "Winner transition complete - stopping all slideshow activity"
            )

            // CRITICAL: Set refs FIRST (synchronous) before state updates (async)
            isWinnerRevealedRef.current = true
            isStoppedRef.current = true

            // Stop slideshow completely - set states
            setIsStopped(true)
            setIsWinnerRevealed(true)

            // Immediately clear any running intervals/timeouts
            if (intervalRef.current) {
              if (isFastRecapMode) {
                clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
              } else {
                clearInterval(intervalRef.current)
              }
              intervalRef.current = null
            }

            // Clear recap mode timer if it exists
            if (recapModeTimerRef.current) {
              clearTimeout(recapModeTimerRef.current)
              recapModeTimerRef.current = null
            }

            // Set transitioning ref to false to allow winner effects
            isTransitioningRef.current = false
            setIsTransitioning(false)

            // Add winner effects
            nextImg.classList.add("winner-image")

            // Start fireworks animations after a short delay to ensure DOM is ready
            setTimeout(() => {
              startFireworksAnimations()
            }, 200)
          },
        })
      } else {
        // Beautiful 3D entrance with perspective
        // Memory Recap Mode: More dynamic entrance (like flipping memories)
        const entranceX = isFastRecapMode ? xMovement : 0
        const entranceZ = isFastRecapMode ? -zMovement * 0.8 : -250

        nextImg.style.opacity = "0"
        nextImg.style.transform = `scale(${
          isFastRecapMode ? 0.8 : 0.85
        }) translateY(30px) translateX(${entranceX}px) translateZ(${entranceZ}px) rotateY(${rotationY}deg) rotateX(${rotationX}deg)`
        nextImg.style.filter = isFastRecapMode
          ? "blur(6px) brightness(0.5)"
          : "blur(8px) brightness(0.6)"

        gsap.to(nextImg, {
          opacity: 1,
          scale: 1,
          y: 0,
          x: 0,
          z: 0,
          rotationY: 0,
          rotationX: 0,
          filter: "blur(0px) brightness(1)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          duration: TRANSITION_DURATION,
          ease: isFastRecapMode ? "power1.out" : "power3.out", // Faster easing in recap mode
        })
      }

      // Text animation
      if (textRef.current) {
        gsap.to(textRef.current, {
          opacity: 0,
          y: -20,
          duration: TRANSITION_DURATION * 0.5,
          ease: "power1.inOut",
          onComplete: () => {
            setCurrentImageInfo(nextImageInfo)
            setCurrentIndex(nextIndex)
            currentIndexRef.current = nextIndex

            // Track shown images in first cycle
            if (!isFirstCycleCompleteRef.current) {
              shownInFirstCycleRef.current.add(nextIndex)
              // Check if first cycle is complete
              if (shownInFirstCycleRef.current.size >= imageList.length) {
                console.log(
                  "First cycle complete! Switching to MEMORY RECAP MODE - Grid Phase"
                )
                isFirstCycleCompleteRef.current = true
                
                // Smooth transition to recap mode - fade out current image first
                if (currentImageRef.current) {
                  gsap.to(currentImageRef.current, {
                    opacity: 0,
                    scale: 0.8,
                    z: -300,
                    filter: "blur(10px) brightness(0.5)",
                    duration: 0.6,
                    ease: "power2.in",
                    onComplete: () => {
                      setIsFastRecapMode(true)
                      setRecapPhase("grid")
                      recapModeStartTimeRef.current = Date.now()
                      // Reset recap tracking
                      shownInRecapRef.current.clear()
                      recapStartIndexRef.current = null
                      isRecapCompleteRef.current = false
                    }
                  })
                } else {
                  setIsFastRecapMode(true)
                  setRecapPhase("grid")
                  recapModeStartTimeRef.current = Date.now()
                  shownInRecapRef.current.clear()
                  recapStartIndexRef.current = null
                  isRecapCompleteRef.current = false
                }
              }
            }

            setTimeout(() => {
              if (textRef.current) {
                gsap.fromTo(
                  textRef.current,
                  { opacity: 0, y: 20 },
                  {
                    opacity: 1,
                    y: 0,
                    duration: TRANSITION_DURATION * 0.5,
                    ease: "power1.out",
                  }
                )
              }
            }, 0)
          },
        })
      } else {
        setCurrentImageInfo(nextImageInfo)
        setCurrentIndex(nextIndex)
        currentIndexRef.current = nextIndex

        // Track shown images in first cycle
        if (!isFirstCycleCompleteRef.current) {
          shownInFirstCycleRef.current.add(nextIndex)
          // Check if first cycle is complete
          if (shownInFirstCycleRef.current.size >= imageList.length) {
            console.log("First cycle complete! Switching to MEMORY RECAP MODE - Grid Phase")
            isFirstCycleCompleteRef.current = true
            
            // Smooth transition to recap mode - fade out current image first
            if (currentImageRef.current) {
              gsap.to(currentImageRef.current, {
                opacity: 0,
                scale: 0.8,
                z: -300,
                filter: "blur(10px) brightness(0.5)",
                duration: 0.6,
                ease: "power2.in",
                onComplete: () => {
                  setIsFastRecapMode(true)
                  setRecapPhase("grid")
                  recapModeStartTimeRef.current = Date.now()
                  // Reset recap tracking
                  shownInRecapRef.current.clear()
                  recapStartIndexRef.current = null
                  isRecapCompleteRef.current = false
                }
              })
            } else {
              setIsFastRecapMode(true)
              setRecapPhase("grid")
              recapModeStartTimeRef.current = Date.now()
              shownInRecapRef.current.clear()
              recapStartIndexRef.current = null
              isRecapCompleteRef.current = false
            }
          }
        }
      }

      // Complete transition
      setTimeout(() => {
        // Check if winner was revealed during transition - if so, don't swap refs
        if (isWinnerRevealedRef.current || isStoppedRef.current) {
          console.log("Winner revealed during transition, skipping ref swap")
          isTransitioningRef.current = false
          setIsTransitioning(false)
          return
        }

        // Hide current image and reset transforms
        currentImg.style.display = "none"
        currentImg.style.opacity = "1"
        currentImg.style.transform =
          "scale(1) translateY(0) translateZ(0) rotateY(0deg) rotateX(0deg)"
        currentImg.style.filter = "blur(0px) brightness(1)"

        // Reset next image transforms
        nextImg.style.transform =
          "scale(1) translateY(0) translateZ(0) rotateY(0deg) rotateX(0deg)"
        nextImg.style.filter = "blur(0px) brightness(1)"

        // Swap refs
        const temp = currentImageRef.current
        currentImageRef.current = nextImageRef.current
        nextImageRef.current = temp

        isTransitioningRef.current = false
        setIsTransitioning(false)
      }, TRANSITION_DURATION * 1000)
    },
    [imageList, WINNER_INDEX, isWinnerRevealed, isStopped]
  )

  // Helper to find next valid image index
  const getNextValidIndex = useCallback(
    (startIndex: number): number => {
      if (imageList.length === 0) return 0
      return (startIndex + 1) % imageList.length
    },
    [imageList.length]
  )

  // Helper to get next image for Memory Recap Mode (sequential, skipping winner)
  const getNextRecapIndex = useCallback(
    (startIndex: number): number | null => {
      if (imageList.length === 0) return null

      // If recap hasn't started, start from index 0
      if (recapStartIndexRef.current === null) {
        recapStartIndexRef.current = 0
        return 0
      }

      // Find next index sequentially, skipping winner
      let nextIndex = startIndex + 1

      // If we've gone through all images, return null to signal completion
      if (nextIndex >= imageList.length) {
        return null
      }

      // Skip winner index during recap
      if (nextIndex === WINNER_INDEX && WINNER_INDEX !== -1) {
        nextIndex = nextIndex + 1
        // If winner was the last image, we're done
        if (nextIndex >= imageList.length) {
          return null
        }
      }

      return nextIndex
    },
    [imageList.length, WINNER_INDEX]
  )

  // Start elegant sparkle animations when winner is revealed
  const startFireworksAnimations = useCallback(() => {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
      // Animate elegant sparkles - gentle and premium
      const animateSparkle = (
        element: HTMLElement,
        direction: "left" | "right"
      ) => {
        const yOffset = (Math.random() - 0.5) * 80
        const delay = Math.random() * 2
        const duration = 3 + Math.random() * 2
        const xDistance =
          direction === "left"
            ? -60 - Math.random() * 40
            : 60 + Math.random() * 40

        // Reset position first
        gsap.set(element, {
          opacity: 0,
          x: 0,
          y: 0,
          scale: 0,
        })

        // Brilliant, spectacular animation - make particles truly brilliant
        gsap.to(element, {
          opacity: 1,
          x: xDistance * (1.2 + Math.random() * 0.3),
          y: yOffset + (Math.random() - 0.5) * 40,
          scale: 1.8 + Math.random() * 0.7,
          rotation: (Math.random() - 0.5) * 360,
          duration: duration * 0.5,
          ease: "power2.out",
          delay: delay,
          onComplete: () => {
            gsap.to(element, {
              opacity: 0,
              x: direction === "left" ? -150 : 150,
              y: yOffset + (Math.random() - 0.5) * 60,
              scale: 0.1,
              rotation: (Math.random() - 0.5) * 720,
              duration: duration * 0.5,
              ease: "power2.in",
              onComplete: () => {
                // Restart animation if winner still revealed
                setTimeout(() => {
                  if (isWinnerRevealed) {
                    animateSparkle(element, direction)
                  }
                }, Math.random() * 1500 + 1000)
              },
            })
          },
        })
      }

      // Start animations for all sparkles
      const leftSparkles = document.querySelectorAll('[data-firework="left"]')
      console.log(`Found ${leftSparkles.length} left sparkles`)
      leftSparkles.forEach((sparkle) => {
        animateSparkle(sparkle as HTMLElement, "left")
      })

      const rightSparkles = document.querySelectorAll('[data-firework="right"]')
      console.log(`Found ${rightSparkles.length} right sparkles`)
      rightSparkles.forEach((sparkle) => {
        animateSparkle(sparkle as HTMLElement, "right")
      })
    }, 100)
  }, [isWinnerRevealed])

  // Auto-advance slideshow - continue cycling through all images until timer triggers
  useEffect(() => {
    // Wait for initial delay before starting slideshow
    if (!initialDelayComplete && !initialDelayCompleteRef.current) {
      console.log("Waiting for initial delay before starting slideshow")
      return
    }
    
    // Check both state and ref for immediate stopping
    const shouldStop =
      imageList.length === 0 ||
      isStopped ||
      isStoppedRef.current ||
      isWinnerRevealed ||
      isWinnerRevealedRef.current

    if (shouldStop) {
      // Clear interval/timeout if winner is revealed or stopped
      if (intervalRef.current) {
        if (isFastRecapMode) {
          clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
        } else {
          clearInterval(intervalRef.current)
        }
        intervalRef.current = null
      }
      console.log(
        "Slideshow stopped - isStopped:",
        isStopped,
        "ref:",
        isStoppedRef.current,
        "isWinnerRevealed:",
        isWinnerRevealed,
        "ref:",
        isWinnerRevealedRef.current
      )
      return
    }

    // Clear existing interval/timeout before creating new one (important when IMAGE_DURATION changes)
    if (intervalRef.current) {
      if (isFastRecapMode) {
        clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
      } else {
        clearInterval(intervalRef.current)
      }
      intervalRef.current = null
    }

    // Use dynamic duration based on mode
    const getCurrentDuration = () => {
      if (isFastRecapMode) {
        return getFastRecapDuration() // 0.3-0.5s randomized
      }
      return NORMAL_IMAGE_DURATION
    }

    const scheduleNext = () => {
      // CRITICAL: Stop scheduling if winner is revealed - check both state and ref
      if (
        isWinnerRevealed ||
        isWinnerRevealedRef.current ||
        isStopped ||
        isStoppedRef.current
      ) {
        console.log(
          "Winner revealed or stopped, canceling scheduleNext - isWinnerRevealed:",
          isWinnerRevealed,
          "ref:",
          isWinnerRevealedRef.current,
          "isStopped:",
          isStopped,
          "ref:",
          isStoppedRef.current
        )
        // Clear interval/timeout if still exists
        if (intervalRef.current) {
          if (isFastRecapMode) {
            clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
          } else {
            clearInterval(intervalRef.current)
          }
          intervalRef.current = null
        }
        return
      }

      if (
        !isTransitioningRef.current &&
        !isTransitioning &&
        !isStopped &&
        !isStoppedRef.current &&
        !isWinnerRevealed &&
        !isWinnerRevealedRef.current
      ) {
        let nextIndex: number | null

        if (isFastRecapMode) {
          // Memory Recap Mode: Don't auto-advance during grid/flash phases
          // The recap phase useEffect handles the sequence
          if (recapPhase === "grid" || recapPhase === "flash") {
            return // Don't schedule transitions during grid/flash phases
          }
          // Only continue normal cycling if we're past flash phase
          nextIndex = getNextValidIndex(currentIndexRef.current)
        } else {
          // Normal mode: Continue cycling through all images
          nextIndex = getNextValidIndex(currentIndexRef.current)
        }

        if (nextIndex !== null && nextIndex !== currentIndexRef.current) {
          // FINAL CHECK: Don't transition if winner is revealed
          if (
            isWinnerRevealedRef.current ||
            isStoppedRef.current ||
            isWinnerRevealed ||
            isStopped
          ) {
            console.log(
              "FINAL CHECK: Winner revealed or stopped, blocking transition to index",
              nextIndex
            )
            // Clear interval/timeout
            if (intervalRef.current) {
              if (isFastRecapMode) {
                clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
              } else {
                clearInterval(intervalRef.current)
              }
              intervalRef.current = null
            }
            return
          }
          transitionToNext(nextIndex, false) // Always pass false - winner transition handled separately
        }
      }
    }

    // In fast recap mode, use dynamic duration for each transition
    if (isFastRecapMode) {
      const scheduleRecapTransition = () => {
        // Check refs FIRST before scheduling
        if (isWinnerRevealedRef.current || isStoppedRef.current) {
          console.log("Winner revealed or stopped, canceling recap schedule")
          intervalRef.current = null
          return
        }

        scheduleNext()

        // Check again before scheduling next
        if (isWinnerRevealedRef.current || isStoppedRef.current) {
          console.log("Winner revealed or stopped, canceling recap schedule")
          intervalRef.current = null
          return
        }

        const duration = getCurrentDuration()
        intervalRef.current = setTimeout(() => {
          scheduleRecapTransition()
        }, duration) as unknown as NodeJS.Timeout
      }
      scheduleRecapTransition()
    } else {
      // Normal mode: fixed interval
      intervalRef.current = setInterval(() => {
        // Check refs FIRST before scheduling
        if (isWinnerRevealedRef.current || isStoppedRef.current) {
          console.log("Winner revealed or stopped, clearing interval")
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return
        }
        scheduleNext()
      }, NORMAL_IMAGE_DURATION)
    }

    return () => {
      if (intervalRef.current) {
        if (isFastRecapMode) {
          clearTimeout(intervalRef.current as unknown as NodeJS.Timeout)
        } else {
          clearInterval(intervalRef.current)
        }
        intervalRef.current = null
      }
    }
  }, [
    isTransitioning,
    isStopped,
    isWinnerRevealed,
    imageList.length,
    transitionToNext,
    getNextValidIndex,
    isFastRecapMode, // Re-create interval when fast recap mode changes
    initialDelayComplete, // Re-create interval when initial delay completes
  ])

  // Memory Recap Mode: Grid -> Flash -> Winner sequence
  useEffect(() => {
    if (!isFastRecapMode || recapPhase !== "grid") return

    console.log("Memory Recap Mode - Grid Phase: Showing all images simultaneously")

    // Phase 1: Show all images in grid (2 seconds)
    const gridTimer = setTimeout(() => {
      console.log("Memory Recap Mode - Flash Phase: Flashing 2-3 random images")
      
      // Smooth transition: fade grid slightly, then switch to flash phase
      const gridContainer = document.querySelector('[data-recap-grid]')
      if (gridContainer) {
        gsap.to(gridContainer, {
          opacity: 0.7,
          scale: 0.98,
          duration: 0.4,
          ease: "power1.inOut",
          onComplete: () => {
            setRecapPhase("flash")
            // Restore opacity after phase change
            gsap.to(gridContainer, {
              opacity: 1,
              scale: 1,
              duration: 0.3,
              ease: "power1.out",
            })
          }
        })
      } else {
        setRecapPhase("flash")
      }

      // Select 2-3 random images to flash (excluding winner)
      const nonWinnerImages = imageList
        .map((_, index) => index)
        .filter((index) => index !== WINNER_INDEX)
      const flashCount = Math.min(2 + Math.floor(Math.random() * 2), nonWinnerImages.length) // 2-3 images
      const selectedFlashImages: number[] = []
      const availableIndices = [...nonWinnerImages]

      for (let i = 0; i < flashCount && availableIndices.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableIndices.length)
        selectedFlashImages.push(availableIndices[randomIndex])
        availableIndices.splice(randomIndex, 1)
      }

      setFlashingImages(selectedFlashImages)
      console.log("Flashing images at indices:", selectedFlashImages)

      // Phase 2: Flash effects (2 seconds)
      const flashTimer = setTimeout(() => {
        console.log("Memory Recap Mode - Winner Phase: Zooming in winner")
        
        // Smooth transition: fade out grid/flash, then show winner
        const gridContainer = document.querySelector('[data-recap-grid]')
        if (gridContainer) {
          gsap.to(gridContainer, {
            opacity: 0,
            scale: 0.9,
            filter: "blur(10px)",
            duration: 0.6,
            ease: "power2.in",
            onComplete: () => {
              setRecapPhase("winner")
              setFlashingImages([])
              
              // Phase 3: Transition to winner (after brief pause)
              setTimeout(() => {
                if (
                  WINNER_INDEX !== -1 &&
                  !isTransitioningRef.current &&
                  !isWinnerRevealedRef.current &&
                  !isStoppedRef.current
                ) {
                  // Ensure current image is set to winner for zoom effect
                  if (currentImageRef.current && imageList[WINNER_INDEX]) {
                    // Update image info
                    setCurrentImageInfo(imageList[WINNER_INDEX])
                    setCurrentIndex(WINNER_INDEX)
                    currentIndexRef.current = WINNER_INDEX
                    
                    currentImageRef.current.src = imageList[WINNER_INDEX].image
                    currentImageRef.current.style.display = "block"
                    currentImageRef.current.style.opacity = "0"
                    currentImageRef.current.style.transform = "scale(0.2) translateZ(-600px) rotateY(20deg)"
                    currentImageRef.current.style.filter = "blur(10px) brightness(0.5)"
                    
                    // Zoom in winner with dramatic effect
                    gsap.to(currentImageRef.current, {
                      opacity: 1,
                      scale: 1.05,
                      z: 0,
                      rotationY: 0,
                      filter: "blur(0px) brightness(1)",
                      duration: 1.8,
                      ease: "back.out(2.5)",
                      onComplete: () => {
                        // Trigger winner transition with effects
                        transitionToNext(WINNER_INDEX, true)
                      }
                    })
                  } else {
                    transitionToNext(WINNER_INDEX, true)
                  }
                }
              }, 300)
            }
          })
        } else {
          setRecapPhase("winner")
          setFlashingImages([])
          setTimeout(() => {
            if (
              WINNER_INDEX !== -1 &&
              !isTransitioningRef.current &&
              !isWinnerRevealedRef.current &&
              !isStoppedRef.current
            ) {
              transitionToNext(WINNER_INDEX, true)
            }
          }, 300)
        }
      }, 2000)

      return () => clearTimeout(flashTimer)
    }, 2000)

    return () => clearTimeout(gridTimer)
  }, [isFastRecapMode, recapPhase, imageList, WINNER_INDEX, transitionToNext])

  // Initialize first image and animate title entrance - with 5 second delay
  useEffect(() => {
    if (currentImageRef.current && imageList.length > 0) {
      // Mark first image as shown in first cycle
      shownInFirstCycleRef.current.add(0)

      currentImageRef.current.src = imageList[0].image
      currentImageRef.current.style.opacity = "0"
      
      // Wait 5 seconds before starting slideshow
      console.log(`Waiting ${INITIAL_DELAY_MS}ms before starting slideshow...`)
      
      const delayTimer = setTimeout(() => {
        console.log("Initial delay complete, starting slideshow")
        initialDelayCompleteRef.current = true
        setInitialDelayComplete(true) // Trigger re-render to start auto-advance
        
        if (currentImageRef.current) {
          currentImageRef.current.style.transform =
            "scale(0.9) translateZ(-200px) rotateY(15deg)"
          currentImageRef.current.style.filter = "blur(5px) brightness(0.7)"
          currentImageRef.current.style.transformStyle = "preserve-3d"

          gsap.to(currentImageRef.current, {
            opacity: 1,
            scale: 1,
            z: 0,
            rotationY: 0,
            filter: "blur(0px) brightness(1)",
            duration: 1.5,
            ease: "power3.out",
          })
        }
        
        // Show text overlay with fade-in animation
        if (textRef.current) {
          gsap.to(textRef.current, {
            opacity: 1,
            visibility: "visible",
            duration: 0.8,
            ease: "power2.out",
          })
        }
      }, INITIAL_DELAY_MS)
      
      return () => {
        clearTimeout(delayTimer)
      }
    }

    // Animate title entrance
    const titleElement = document.querySelector(".title-animated")
    if (titleElement) {
      // Ensure it's visible first
      ;(titleElement as HTMLElement).style.opacity = "1"
      ;(titleElement as HTMLElement).style.visibility = "visible"

      gsap.fromTo(
        titleElement,
        {
          opacity: 0,
          y: -30,
          scale: 0.9,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: "back.out(1.7)",
          delay: 0.3,
        }
      )
    }
  }, [])

  // Start fireworks when winner is revealed
  useEffect(() => {
    if (isWinnerRevealed) {
      // Start animations after DOM is ready
      const timer1 = setTimeout(() => {
        startFireworksAnimations()
      }, 300)

      // Also start after transition completes
      const timer2 = setTimeout(() => {
        startFireworksAnimations()
      }, TRANSITION_DURATION * 1000 * 1.2 + 800)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
  }, [isWinnerRevealed, startFireworksAnimations])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden"
    >
      {/* Background image overlay - darkened for focus, full screen */}
      <div
        className="absolute inset-0 w-full h-full z-0"
        style={{
          backgroundImage: "url('/images/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#0a1628",
          opacity: 0.5,
          filter: "brightness(0.7)",
          minWidth: "100%",
          minHeight: "100%",
        }}
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo - Top Left */}
          <div className="flex-shrink-0">
            <img
              src="/kozocom-logo.png"
              alt="Kozocom Logo"
              className="h-10 md:h-12 lg:h-14 w-auto opacity-90 hover:opacity-100 transition-opacity duration-300"
              style={{
                filter:
                  "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.1))",
              }}
            />
          </div>

          {/* Center Title - Beautiful animated */}
          <div className="flex-1 flex justify-center px-4">
            <h1
              className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-center title-animated"
              style={{
                color: "#ffffff",
                background:
                  "linear-gradient(135deg, #ffffff 0%, #e0e7ff 20%, #c7d2fe 40%, #a5b4fc 60%, #818cf8 80%, #6366f1 100%)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow:
                  "0 0 40px rgba(167, 139, 250, 0.5), 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 60px rgba(99, 102, 241, 0.3)",
                filter: "drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5))",
                letterSpacing: "0.05em",
                fontFamily: "'Playfair Display', 'Georgia', serif",
                animation:
                  "titleShimmer 3s ease-in-out infinite, titleGlow 2s ease-in-out infinite",
                position: "relative",
                opacity: 1,
                visibility: "visible",
                display: "block",
                zIndex: 1,
              }}
            >
              MOMENT OF THE YEAR 2025
            </h1>
          </div>

          {/* Year End Party - Top Right */}
          <div className="flex-shrink-0 text-right">
            <p
              className="text-sm md:text-base lg:text-lg font-medium"
              style={{
                background:
                  "linear-gradient(135deg, #ffffff 0%, #e0e7ff 50%, #c7d2fe 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow:
                  "0 2px 10px rgba(130, 147, 234, 0.6), 0 0 30px rgba(102, 155, 225, 0.4)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6))",
              }}
            >
              year end party
            </p>
          </div>
        </div>
      </div>

      {/* Image container - centered gallery style with 3D perspective */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{
          perspective: "1200px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        {/* Memory Recap Mode: Grid Layout - Show all images simultaneously */}
        {isFastRecapMode && (recapPhase === "grid" || recapPhase === "flash") && (
          <div 
            className="absolute inset-0 z-10 flex items-center justify-center p-2 md:p-3 lg:p-4 overflow-auto"
            data-recap-grid
            style={{
              animation: recapPhase === "grid" 
                ? "sceneTransitionIn 0.8s ease-out forwards"
                : recapPhase === "flash"
                ? "sceneFlashTransition 0.6s ease-in-out forwards"
                : "none",
            }}
          >
            <div
              className="grid w-full max-w-[98vw]"
              style={{
                gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(imageList.length))}, minmax(0, 1fr))`,
                gap: "6px",
                placeItems: "stretch",
                padding: "8px",
              }}
            >
              {imageList.map((imgInfo, index) => {
                const isFlashing = flashingImages.includes(index)
                // Random tilt for each image (slight rotation from side to side) - varied angles
                // Use a seed based on index for consistent but varied tilts
                const seed = index * 7 + 13
                const tiltAngle = ((seed % 7) - 3) * (2 + (seed % 3)) // -15 to +15 degrees, varied
                const tiltDirection = seed % 2 === 0 ? 1 : -1
                const finalTilt = tiltAngle * tiltDirection * 0.6 // Scale down to -9 to +9 degrees
                
                return (
                  <div
                    key={`recap-grid-${index}`}
                    className="relative aspect-square overflow-hidden"
                    style={{
                      width: "75%", // Make images smaller (75% of grid cell)
                      margin: "auto",
                      opacity: recapPhase === "grid" ? 1 : isFlashing ? 1 : 0.2,
                      filter: isFlashing
                        ? "brightness(1.4) saturate(1.4)"
                        : recapPhase === "flash"
                        ? "brightness(0.3) grayscale(0.7)"
                        : "brightness(0.9)",
                      transition: "all 0.5s ease-in-out",
                      transform: `rotateZ(${finalTilt}deg)`,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <img
                      src={imgInfo.image}
                      alt={imgInfo.actor}
                      className="w-full h-full object-cover rounded-md shadow-xl"
                      style={{
                        animation:
                          recapPhase === "grid"
                            ? `gridImageAppear ${0.1 + (index % imageList.length) * 0.015}s ease-out forwards`
                            : isFlashing
                            ? "flashPulse 0.5s ease-in-out infinite"
                            : "none",
                        animationDelay:
                          recapPhase === "grid" ? `${(index % imageList.length) * 0.01}s` : "0s",
                        transformStyle: "preserve-3d",
                        boxShadow: isFlashing
                          ? "0 0 70px rgba(255, 215, 0, 1.2), 0 0 140px rgba(255, 215, 0, 1), 0 0 200px rgba(255, 215, 0, 0.8), inset 0 0 50px rgba(255, 215, 0, 0.3)"
                          : "0 6px 20px rgba(0, 0, 0, 0.5)",
                        transform: isFlashing ? "scale(1.15)" : "scale(1)",
                        zIndex: isFlashing ? 30 : 10,
                        border: isFlashing ? "2px solid rgba(255, 215, 0, 0.8)" : "none",
                        opacity: recapPhase === "grid" ? 0 : 1, // Start hidden, animation makes visible
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}


        {/* Normal mode or Winner phase: Single image display */}
        {(!isFastRecapMode || recapPhase === "winner") && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{
              animation: recapPhase === "winner" && isFastRecapMode
                ? "sceneWinnerTransition 1s ease-out forwards"
                : "none",
            }}
          >
            {/* Current image */}
            <img
              ref={currentImageRef}
              alt={currentImageInfo.actor}
              className="absolute max-w-[90vw] max-h-[75vh] w-auto h-auto object-contain rounded-lg"
              style={{
                transition:
                  "transform 0.3s ease-out, filter 0.3s ease-out, box-shadow 0.3s ease-out",
                willChange: "transform, opacity, filter",
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                boxShadow:
                  "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              }}
            />

            {/* Next image (for transitions) */}
            <img
              ref={nextImageRef}
              alt=""
              className="absolute max-w-[90vw] max-h-[75vh] w-auto h-auto object-contain rounded-lg"
              style={{
                display: "none",
                transition:
                  "transform 0.3s ease-out, filter 0.3s ease-out, box-shadow 0.3s ease-out",
                willChange: "transform, opacity, filter",
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                boxShadow:
                  "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              }}
            />
          </div>
        )}
        
        {/* Scene transition overlay - for smooth transitions between phases */}
        {isFastRecapMode && (
          <div
            className="absolute inset-0 z-9 pointer-events-none"
            style={{
              background: 
                recapPhase === "grid"
                  ? "radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%)"
                  : recapPhase === "flash"
                  ? "radial-gradient(circle at center, rgba(255, 215, 0, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%)"
                  : "transparent",
              opacity: recapPhase === "grid" ? 0 : recapPhase === "flash" ? 0.5 : 0,
              transition: "opacity 0.6s ease-in-out, background 0.6s ease-in-out",
              animation: recapPhase === "flash" ? "flashOverlayPulse 1s ease-in-out infinite" : "none",
            }}
          />
        )}
      </div>

      {/* Text overlay - higher z-index to ensure it's above flash overlay */}
      <div
        ref={textRef}
        className="absolute bottom-0 left-0 right-0 z-50 px-6 md:px-12 pb-4 text-center pointer-events-none"
        style={{
          background: isWinnerRevealed
            ? "linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.92) 20%, rgba(0, 0, 0, 0.88) 40%, rgba(0, 0, 0, 0.8) 60%, rgba(0, 0, 0, 0.6) 80%, transparent 100%)"
            : "linear-gradient(to top, rgba(5, 8, 16, 0.98) 0%, rgba(5, 8, 16, 0.85) 40%, rgba(5, 8, 16, 0.5) 70%, transparent 100%)",
          opacity:
            (initialDelayComplete || initialDelayCompleteRef.current) &&
            (!isFastRecapMode || recapPhase === "winner")
              ? 1
              : 0,
          visibility:
            (initialDelayComplete || initialDelayCompleteRef.current) &&
            (!isFastRecapMode || recapPhase === "winner")
              ? "visible"
              : "hidden",
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <div className="max-w-5xl mx-auto space-y-2">
          {/* Description */}
          {currentImageInfo.description &&
            (() => {
              const descriptionParts = currentImageInfo.description.split("\n")
              const vietnameseText = descriptionParts[0] || ""
              const japaneseText = descriptionParts[1] || ""

              return (
                <div className="">
                  {/* Vietnamese */}
                  {vietnameseText && (
                    <p
                      className="text-xl md:text-2xl font-bold"
                      style={{
                        textShadow:
                          "0 1px 8px rgba(0, 0, 0, 0.95), 0 2px 15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.3), 0 0 50px rgba(167, 139, 250, 0.2)",
                        letterSpacing: "0.08em",
                        lineHeight: "1.5",
                        opacity: 0.8,
                        filter: "drop-shadow(0 3px 10px rgba(0, 0, 0, 0.51))",
                      }}
                    >
                      {vietnameseText}
                    </p>
                  )}

                  {/* Japanese */}
                  {japaneseText && (
                    <p
                      className="text-base md:text-lg lg:text-2xl font-light text-gray-200"
                      style={{
                        textShadow:
                          "0 1px 8px rgba(0, 0, 0, 0.95), 0 2px 15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.3), 0 0 50px rgba(167, 139, 250, 0.2)",
                        letterSpacing: "0.08em",
                        lineHeight: "1.2",
                        fontStyle: "normal",
                        opacity: 0.9,
                        fontFamily:
                          "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif",
                      }}
                    >
                      {japaneseText}
                    </p>
                  )}
                </div>
              )
            })()}

          {/* Actor name */}
          {currentImageInfo.actor && (
            <div
              className="mt-2 relative z-50"
              style={{ position: "relative" }}
            >
              <h2
                className={`text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight relative z-10 ${
                  isWinnerRevealed ? "animate-pulse" : ""
                }`}
                style={{
                  color: isWinnerRevealed ? "#ffd700" : "transparent", // Use solid color for winner
                  background: isWinnerRevealed
                    ? "none" // No gradient for winner - use solid color
                    : "linear-gradient(135deg, #ffffff 0%, #e0e7ff 30%, #c7d2fe 60%, #a5b4fc 100%)",
                  WebkitBackgroundClip: isWinnerRevealed ? "unset" : "text",
                  WebkitTextFillColor: isWinnerRevealed
                    ? "#ffd700"
                    : "transparent",
                  backgroundClip: isWinnerRevealed ? "unset" : "text",
                  textShadow: isWinnerRevealed
                    ? "0 0 20px rgba(255, 215, 0, 1), 0 2px 10px rgba(0, 0, 0, 1), 0 4px 20px rgba(0, 0, 0, 1), 0 0 40px rgba(255, 215, 0, 0.8), 3px 3px 6px rgba(0, 0, 0, 1)"
                    : "0 0 40px rgba(214, 224, 231, 0.5), 0 4px 20px rgba(22, 198, 241, 0.54), 0 0 60px rgba(230, 237, 244, 0.3)",
                  filter: isWinnerRevealed
                    ? "drop-shadow(0 4px 20px rgba(0, 0, 0, 1)) drop-shadow(0 0 30px rgba(255, 215, 0, 0.9))"
                    : "drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5))",
                  letterSpacing: "-0.02em",
                  animation: isWinnerRevealed
                    ? "glowPulse 2s ease-in-out infinite"
                    : "none",
                  position: "relative",
                  zIndex: 10,
                  fontWeight: 900,
                  lineHeight: 1.5,
                }}
              >
                {currentImageInfo.actor}
                {isWinnerRevealed && (
                  <span
                    className="ml-3 text-3xl md:text-4xl lg:text-5xl xl:text-6xl"
                    style={{
                      filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 1))",
                    }}
                  >
                    🏆
                  </span>
                )}
              </h2>
            </div>
          )}

          {/* Progress indicator */}
          <div className="mt-6 flex justify-center gap-2">
            {imageList.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                  index === currentIndex
                    ? "w-16 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 shadow-lg shadow-blue-400/50"
                    : "w-2 bg-blue-400/20 hover:bg-blue-400/40"
                }`}
                style={{
                  boxShadow:
                    index === currentIndex
                      ? "0 0 10px rgba(96, 165, 250, 0.6), 0 0 20px rgba(96, 165, 250, 0.4)"
                      : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Elegant light rays/bloom for winner reveal - soft and emotional */}
      {isWinnerRevealed && (
        <>
          {/* Soft radial glow */}
          <div
            className="absolute inset-0 z-5 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at center, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.08) 30%, transparent 50%)",
              animation: "softGlow 4s ease-in-out infinite",
              clipPath: "inset(0 0 40% 0)", // Only cover top 60% of screen, leave bottom 40% for text
            }}
          />
          {/* Gentle light rays from center */}
          <div
            className="absolute inset-0 z-4 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255, 215, 0, 0.1) 0%, transparent 60%)",
              animation: "gentleBloom 5s ease-in-out infinite",
              clipPath: "inset(0 0 40% 0)",
            }}
          />
        </>
      )}

      {/* Elegant Side Effects for Winner */}
      {isWinnerRevealed && (
        <>
          {/* Left side elegant sparkles - subtle and emotional */}
          <div className="absolute left-0 top-0 bottom-0 w-32 md:w-48 z-20 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => {
              const colors = [
                "#ffd700",
                "#ffed4e",
                "#fff8dc",
                "#ffeb3b",
                "#ffc107",
                "#ffd54f",
                "#ffeb3b",
                "#fff59d",
                "#fff176",
                "#ffd700",
              ]
              const color = colors[Math.floor(Math.random() * colors.length)]
              const size = 3 + Math.random() * 8
              const leftPos = 0 + Math.random() * 30
              const topPos = 0 + Math.random() * 100

              return (
                <div
                  key={`left-${i}`}
                  data-firework="left"
                  className="absolute rounded-full"
                  style={{
                    left: `${leftPos}%`,
                    top: `${topPos}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: `radial-gradient(circle, ${color} 0%, ${color}80 50%, transparent 100%)`,
                    boxShadow: `0 0 ${
                      15 + Math.random() * 25
                    }px ${color}, 0 0 ${
                      8 + Math.random() * 15
                    }px ${color}, 0 0 ${
                      4 + Math.random() * 8
                    }px ${color}, 0 0 ${2 + Math.random() * 4}px ${color}`,
                    opacity: 0,
                    willChange: "transform, opacity",
                    filter: `blur(${Math.random() * 1.5}px)`,
                  }}
                />
              )
            })}
          </div>

          {/* Right side elegant sparkles - subtle and emotional */}
          <div className="absolute right-0 top-0 bottom-0 w-32 md:w-48 z-20 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => {
              const colors = [
                "#ffd700",
                "#ffed4e",
                "#fff8dc",
                "#ffeb3b",
                "#ffc107",
                "#ffd54f",
                "#ffeb3b",
                "#fff59d",
                "#fff176",
                "#ffd700",
              ]
              const color = colors[Math.floor(Math.random() * colors.length)]
              const size = 3 + Math.random() * 8
              const rightPos = 0 + Math.random() * 30
              const topPos = 0 + Math.random() * 100

              return (
                <div
                  key={`right-${i}`}
                  data-firework="right"
                  className="absolute rounded-full"
                  style={{
                    right: `${rightPos}%`,
                    top: `${topPos}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: `radial-gradient(circle, ${color} 0%, ${color}80 50%, transparent 100%)`,
                    boxShadow: `0 0 ${
                      15 + Math.random() * 25
                    }px ${color}, 0 0 ${
                      8 + Math.random() * 15
                    }px ${color}, 0 0 ${
                      4 + Math.random() * 8
                    }px ${color}, 0 0 ${2 + Math.random() * 4}px ${color}`,
                    opacity: 0,
                    willChange: "transform, opacity",
                    filter: `blur(${Math.random() * 1.5}px)`,
                  }}
                />
              )
            })}
          </div>

          {/* Brilliant light rays from sides */}
          <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden">
            {/* Left light ray - multiple layers for brilliance */}
            <div
              className="absolute left-0 top-0 bottom-0 w-80 md:w-[500px] opacity-40"
              style={{
                background:
                  "linear-gradient(to right, rgba(255, 215, 0, 0.6) 0%, rgba(255, 215, 0, 0.3) 30%, rgba(255, 215, 0, 0.1) 60%, transparent 100%)",
                animation: "lightRayLeft 3s ease-in-out infinite",
                clipPath: "polygon(0 0, 100% 15%, 100% 85%, 0 100%)",
                filter: "blur(1px)",
              }}
            />
            <div
              className="absolute left-0 top-0 bottom-0 w-64 md:w-96 opacity-50"
              style={{
                background:
                  "linear-gradient(to right, rgba(255, 215, 0, 0.5) 0%, transparent 100%)",
                animation: "lightRayLeft 2.5s ease-in-out infinite",
                clipPath: "polygon(0 0, 100% 20%, 100% 80%, 0 100%)",
              }}
            />
            {/* Right light ray - multiple layers for brilliance */}
            <div
              className="absolute right-0 top-0 bottom-0 w-80 md:w-[500px] opacity-40"
              style={{
                background:
                  "linear-gradient(to left, rgba(255, 215, 0, 0.6) 0%, rgba(255, 215, 0, 0.3) 30%, rgba(255, 215, 0, 0.1) 60%, transparent 100%)",
                animation: "lightRayRight 3s ease-in-out infinite",
                clipPath: "polygon(0 15%, 100% 0, 100% 100%, 0 85%)",
                filter: "blur(1px)",
              }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-64 md:w-96 opacity-50"
              style={{
                background:
                  "linear-gradient(to left, rgba(255, 215, 0, 0.5) 0%, transparent 100%)",
                animation: "lightRayRight 2.5s ease-in-out infinite",
                clipPath: "polygon(0 20%, 100% 0, 100% 100%, 0 80%)",
              }}
            />
          </div>

          {/* Elegant floating particles - subtle and emotional */}
          <div className="absolute inset-0 z-18 pointer-events-none overflow-hidden">
            {[...Array(15)].map((_, i) => {
              const colors = [
                "#ffd700",
                "#ffed4e",
                "#fff8dc",
                "#ffeb3b",
                "#ffc107",
                "#ffd54f",
                "#fff59d",
                "#fff176",
              ]
              const color = colors[Math.floor(Math.random() * colors.length)]
              const size = 2 + Math.random() * 5
              const leftPos = 20 + Math.random() * 60
              const topPos = 10 + Math.random() * 80

              return (
                <div
                  key={`particle-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${leftPos}%`,
                    top: `${topPos}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                    boxShadow: `0 0 ${8 + Math.random() * 15}px ${color}, 0 0 ${
                      4 + Math.random() * 8
                    }px ${color}`,
                    animation: `floatParticle ${
                      3 + Math.random() * 4
                    }s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 3}s`,
                    opacity: 0.7 + Math.random() * 0.3,
                    filter: `blur(${Math.random() * 0.8}px)`,
                  }}
                />
              )
            })}
          </div>

          {/* Gentle twinkling stars effect */}
          <div className="absolute inset-0 z-19 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => {
              const colors = ["#ffd700", "#ffed4e", "#fff8dc", "#ffeb3b"]
              const color = colors[Math.floor(Math.random() * colors.length)]
              const size = 1 + Math.random() * 3
              const leftPos = 15 + Math.random() * 70
              const topPos = 10 + Math.random() * 80

              return (
                <div
                  key={`star-${i}`}
                  className="absolute"
                  style={{
                    left: `${leftPos}%`,
                    top: `${topPos}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: color,
                    clipPath:
                      "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                    boxShadow: `0 0 ${6 + Math.random() * 10}px ${color}`,
                    animation: `twinkle ${
                      1.5 + Math.random() * 2
                    }s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 2}s`,
                    opacity: 0.8 + Math.random() * 0.2,
                  }}
                />
              )
            })}
          </div>

          {/* Gentle floating particles - subtle celebration */}
          <div className="absolute inset-0 z-17 pointer-events-none overflow-hidden">
            {[...Array(8)].map((_, i) => {
              const colors = ["#ffd700", "#ffed4e", "#ffeb3b", "#ffc107"]
              const color = colors[Math.floor(Math.random() * colors.length)]
              const size = 2 + Math.random() * 4
              const leftPos = 30 + Math.random() * 40
              const topPos = 30 + Math.random() * 40

              return (
                <div
                  key={`burst-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${leftPos}%`,
                    top: `${topPos}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: `radial-gradient(circle, ${color} 0%, transparent 80%)`,
                    boxShadow: `0 0 ${10 + Math.random() * 20}px ${color}`,
                    animation: `burstParticle ${
                      2 + Math.random() * 3
                    }s ease-out infinite`,
                    animationDelay: `${Math.random() * 2}s`,
                    opacity: 0.9,
                  }}
                />
              )
            })}
          </div>
        </>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes softGlow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
        @keyframes gentleBloom {
          0%, 100% {
            opacity: 0.2;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.2);
          }
        }
        @keyframes glowPulse {
          0%, 100% {
            filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 60px rgba(255, 215, 0, 0.8));
          }
          50% {
            filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 100px rgba(255, 215, 0, 1));
          }
        }
        .winner-image {
          animation: winnerPulse 3s ease-in-out infinite, winnerGlow 4s ease-in-out infinite;
          box-shadow: 0 0 40px rgba(255, 215, 0, 0.4), 0 0 80px rgba(255, 215, 0, 0.3), 0 0 120px rgba(255, 215, 0, 0.2);
          filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.5));
        }
        @keyframes winnerPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 40px rgba(255, 215, 0, 0.4), 0 0 80px rgba(255, 215, 0, 0.3), 0 0 120px rgba(255, 215, 0, 0.2);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 0 50px rgba(255, 215, 0, 0.5), 0 0 100px rgba(255, 215, 0, 0.4), 0 0 150px rgba(255, 215, 0, 0.3);
          }
        }
        @keyframes winnerGlow {
          0%, 100% {
            filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.5)) drop-shadow(0 0 60px rgba(255, 215, 0, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.7)) drop-shadow(0 0 80px rgba(255, 215, 0, 0.5)) drop-shadow(0 0 120px rgba(255, 215, 0, 0.3));
          }
        }
        
        /* Memory Recap Mode: Grid image appearance animation */
        @keyframes gridImageAppear {
          0% {
            opacity: 0;
            transform: scale(0.5) translateZ(-150px) rotateY(25deg) rotateZ(0deg);
            visibility: hidden;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            opacity: 1;
            transform: scale(0.75) translateZ(0) rotateY(0deg);
            visibility: visible;
          }
        }
        
        /* Memory Recap Mode: Flash pulse animation */
        @keyframes flashPulse {
          0%, 100% {
            transform: scale(1.1);
            box-shadow: 0 0 60px rgba(255, 215, 0, 1), 0 0 120px rgba(255, 215, 0, 0.8), 0 0 180px rgba(255, 215, 0, 0.6);
          }
          50% {
            transform: scale(1.2);
            box-shadow: 0 0 80px rgba(255, 215, 0, 1.2), 0 0 150px rgba(255, 215, 0, 1), 0 0 220px rgba(255, 215, 0, 0.8);
          }
        }
        
        /* Scene transition animations */
        @keyframes sceneTransitionIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateZ(-200px);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateZ(0);
            filter: blur(0px);
          }
        }
        
        @keyframes sceneFlashTransition {
          0% {
            opacity: 1;
            filter: brightness(1);
          }
          50% {
            opacity: 0.7;
            filter: brightness(1.5);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
        
        @keyframes sceneWinnerTransition {
          0% {
            opacity: 0;
            transform: scale(0.5) translateZ(-400px);
            filter: blur(15px) brightness(0.3);
          }
          60% {
            opacity: 0.8;
            filter: blur(5px) brightness(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateZ(0);
            filter: blur(0px) brightness(1);
          }
        }
        
        @keyframes flashOverlayPulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
        
        /* Title animations */
        @keyframes titleShimmer {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes titleGlow {
          0%, 100% {
            text-shadow: 
              0 0 40px rgba(167, 139, 250, 0.5), 
              0 4px 20px rgba(0, 0, 0, 0.8), 
              0 0 60px rgba(99, 102, 241, 0.3),
              0 0 80px rgba(139, 92, 246, 0.2);
            filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5));
          }
          50% {
            text-shadow: 
              0 0 60px rgba(167, 139, 250, 0.8), 
              0 4px 30px rgba(0, 0, 0, 0.9), 
              0 0 90px rgba(99, 102, 241, 0.6),
              0 0 120px rgba(139, 92, 246, 0.4);
            filter: drop-shadow(0 2px 15px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 40px rgba(167, 139, 250, 0.4));
          }
        }
        
        .title-animated {
          position: relative;
          animation: titleFloat 4s ease-in-out infinite, titleShimmer 3s ease-in-out infinite, titleGlow 2s ease-in-out infinite;
        }
        
        @keyframes titleFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        
        .title-animated::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          animation: titleShine 4s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
          mix-blend-mode: overlay;
        }
        
        @keyframes titleShine {
          0% {
            left: -100%;
          }
          50%, 100% {
            left: 100%;
          }
        }
        
        /* Ensure text is visible - fallback */
        .title-animated {
          -webkit-text-fill-color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
        }
        
        /* Fallback for browsers that don't support background-clip */
        @supports not (background-clip: text) {
          .title-animated {
            color: #ffffff !important;
            background: none !important;
            -webkit-text-fill-color: #ffffff !important;
          }
        }
        
        
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
                    /* Elegant light ray animations */
                    @keyframes lightRayLeft {
                      0%, 100% {
                        opacity: 0.2;
                        transform: translateX(0) translateZ(0);
                      }
                      50% {
                        opacity: 0.4;
                        transform: translateX(20px) translateZ(10px);
                      }
                    }
                    
                    @keyframes lightRayRight {
                      0%, 100% {
                        opacity: 0.2;
                        transform: translateX(0) translateZ(0);
                      }
                      50% {
                        opacity: 0.4;
                        transform: translateX(-20px) translateZ(10px);
                      }
                    }
                    
                    /* 3D transition enhancements */
                    @keyframes image3DEnter {
                      0% {
                        transform: scale(0.85) translateZ(-250px) rotateY(30deg) rotateX(-10deg);
                        opacity: 0;
                        filter: blur(8px) brightness(0.6);
                      }
                      100% {
                        transform: scale(1) translateZ(0) rotateY(0deg) rotateX(0deg);
                        opacity: 1;
                        filter: blur(0px) brightness(1);
                      }
                    }
                    
                    @keyframes image3DExit {
                      0% {
                        transform: scale(1) translateZ(0) rotateY(0deg) rotateX(0deg);
                        opacity: 1;
                        filter: blur(0px) brightness(1);
                      }
                      100% {
                        transform: scale(0.85) translateZ(-200px) rotateY(-25deg) rotateX(5deg);
                        opacity: 0;
                        filter: blur(8px) brightness(0.7);
                      }
                    }
        
                    /* Brilliant floating particles */
                    @keyframes floatParticle {
                      0%, 100% {
                        transform: translateY(0) translateX(0) scale(1) rotate(0deg);
                        opacity: 0.7;
                      }
                      25% {
                        transform: translateY(-30px) translateX(15px) scale(1.3) rotate(90deg);
                        opacity: 1;
                      }
                      50% {
                        transform: translateY(-15px) translateX(-10px) scale(0.8) rotate(180deg);
                        opacity: 0.9;
                      }
                      75% {
                        transform: translateY(-35px) translateX(10px) scale(1.2) rotate(270deg);
                        opacity: 0.8;
                      }
                    }
                    
                    /* Twinkling stars */
                    @keyframes twinkle {
                      0%, 100% {
                        opacity: 0.3;
                        transform: scale(0.8) rotate(0deg);
                      }
                      50% {
                        opacity: 1;
                        transform: scale(1.5) rotate(180deg);
                      }
                    }
                    
                    /* Burst particles */
                    @keyframes burstParticle {
                      0% {
                        transform: scale(0) translate(0, 0);
                        opacity: 0;
                      }
                      20% {
                        transform: scale(1.5) translate(20px, -20px);
                        opacity: 1;
                      }
                      40% {
                        transform: scale(1) translate(-15px, 15px);
                        opacity: 0.9;
                      }
                      60% {
                        transform: scale(1.2) translate(10px, -10px);
                        opacity: 0.8;
                      }
                      100% {
                        transform: scale(0) translate(30px, -30px);
                        opacity: 0;
                      }
                    }
      `}</style>
    </div>
  )
}

export default ImageSlider
export { IMAGES_INFO }
