import gsap from "gsap"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

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
    description: "Kozocom Badminton Club - Gắn kết vượt thời gian\nKozocom Badminton Club - 同僚との強い結び",
  },
  {
    image: "/images/IMG_20251208_102343 - Mai Ho Thi Quynh.jpg",
    actor: "Hồ Thị Quỳnh Mai",
    description: "Sự chăm chỉ hôm nay của những Entry chính là nền móng cho thành công ngày mai\nEntryメンバー一人ひとりの今日の努力こそが、将来の成功を築く基盤",
  },
  {
    image: "/images/IMG_9848 - Nhan Nguyen Trong.jpg",
    actor: "Nguyễn Trọng Nhân",
    description: "Kozocom Panorama",
  },
  {
    image: "/images/IMG_5096 - Thanh Bui Van.jpg",
    actor: "Bùi Văn Thành",
    description: "Một ngày \"rất bình thường\" của Team TAS\nTASチームのごく平凡な一日",
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
    description: "Lớn Rồi Vẫn Thích Quà Trung Thu\n大人になってもこどもの日のプレゼントが好き",
  },
  {
    image: "/images/IMG_20260116_115321 - Vi Pham Thi.jpg",
    actor: "Phạm Thị Vi",
    description: "Hơn cả đồng nghiệp\n同僚以上の関係",
  },
  {
    image: "/images/TẾT 2025 - Ly Tran Thi Khanh.jpg",
    actor: "Trần Thị Khánh Ly",
    description: "Khi nam thần tạm nghỉ, niềm vui lên ngôi\nイケメンのイメージを忘れて、笑いが主役",
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
    description: "Kozocom - Nơi Câu Chuyện Bắt Đầu\nKozocom - 物語が始まった場所",
  },
  {
    image: "/images/IMG_1886 - Van Hoang Thi Cam.jpg",
    actor: "Hoàng Thị Cẩm Vân",
    description: "Chung Nhịp Cười Dưới Ánh Đèn Đêm\nライトアップの下、笑顔が重なる瞬間",
  },
]

const ImageSlider: React.FC<ImageSliderProps> = ({
  images,
  isDarkMode = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const currentImageMeshRef = useRef<THREE.Mesh | null>(null)
  const nextImageMeshRef = useRef<THREE.Mesh | null>(null)
  const imageTexturesRef = useRef<Map<string, THREE.Texture>>(new Map())
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null)
  const isTransitioningRef = useRef(false)
  const failedImagesRef = useRef<Set<number>>(new Set())
  const fireworksSystemRef = useRef<THREE.Points | null>(null)
  const fireworksParticlesRef = useRef<Float32Array | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [currentImageInfo, setCurrentImageInfo] = useState<ImageInfo>(
    IMAGES_INFO[0]
  )
  const [isStopped, setIsStopped] = useState(false)
  const [showFireworks, setShowFireworks] = useState(false)

  // Use provided images or default to IMAGES_INFO - memoized for stability
  const imageList = useMemo(
    () =>
      images
        ? images.map((img) => ({ image: img, actor: "", description: "" }))
        : IMAGES_INFO,
    [images]
  )

  // Image display duration (3 seconds)
  const IMAGE_DURATION = 1500
  // Transition duration
  const TRANSITION_DURATION = 1.5
  // Time to stop at winner image (20 seconds)
  const STOP_AFTER_MS = 20000
  // Find index of winner image
  const WINNER_INDEX = useMemo(() => {
    return imageList.findIndex((img) => img.actor === "Trần Thị Khánh Ly")
  }, [imageList])

  // Load image texture
  const loadImageTexture = (
    imagePath: string
  ): Promise<THREE.Texture> => {
    return new Promise((resolve, reject) => {
      // Check cache first
      if (imageTexturesRef.current.has(imagePath)) {
        const cachedTexture = imageTexturesRef.current.get(imagePath)!
        // Verify texture is still valid
        if (cachedTexture && cachedTexture.image) {
          resolve(cachedTexture)
          return
        } else {
          // Remove invalid cached texture
          imageTexturesRef.current.delete(imagePath)
        }
      }

      // Check for unsupported formats (HEIC files are not supported in browsers)
      if (imagePath.toLowerCase().endsWith('.heic')) {
        console.warn(
          `HEIC format not supported in browsers: ${imagePath}. Please convert to JPEG or PNG.`
        )
        reject(new Error(`Unsupported image format: ${imagePath}`))
        return
      }

      const loader = new THREE.TextureLoader()
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading image: ${imagePath}`))
      }, 15000) // 15 second timeout

      loader.load(
        imagePath,
        (texture) => {
          clearTimeout(timeout)
          if (!texture || !texture.image) {
            reject(new Error(`Invalid texture loaded: ${imagePath}`))
            return
          }
          
          // Use optimized texture settings for performance
          texture.minFilter = THREE.LinearFilter // Simpler filter for better performance
          texture.magFilter = THREE.LinearFilter
          texture.format = THREE.RGBAFormat
          texture.generateMipmaps = false // Disable mipmaps for better performance
          texture.anisotropy = 1 // Minimal anisotropy for performance
          texture.needsUpdate = true
          
          // Note: For better performance, consider pre-resizing images to max 2048x2048
          // before uploading to reduce memory usage
          
          // Cache the texture
          imageTexturesRef.current.set(imagePath, texture)
          resolve(texture)
        },
        undefined,
        (error) => {
          clearTimeout(timeout)
          console.error("Error loading image:", imagePath, error)
          reject(new Error(`Failed to load image: ${imagePath}. ${error}`))
        }
      )
    })
  }

  // Create image plane
  const createImagePlane = async (
    imagePath: string,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  ): Promise<THREE.Mesh> => {
    const texture = await loadImageTexture(imagePath)

    // Calculate aspect ratio to maintain image proportions
    const aspectRatio = texture.image.width / texture.image.height
    const planeWidth = 10 // Base width
    const planeHeight = planeWidth / aspectRatio

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight)
    // Use MeshBasicMaterial instead of MeshStandardMaterial for better performance
    // (no lighting calculations needed)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.userData = { imagePath }

    return mesh
  }

  // Transition between images - memoized with useCallback
  const transitionToNext = useCallback(
    async (nextIndex: number) => {
      if (isTransitioningRef.current || !sceneRef.current || !cameraRef.current) {
        return
      }

      // Validate nextIndex
      if (nextIndex < 0 || nextIndex >= imageList.length) {
        console.error("Invalid nextIndex:", nextIndex)
        return
      }

      isTransitioningRef.current = true
      setIsTransitioning(true)
      const nextImageInfo = imageList[nextIndex]
      const currentMesh = currentImageMeshRef.current

      try {
      // Create next image mesh (positioned slightly behind and scaled down)
      const nextMesh = await createImagePlane(
        nextImageInfo.image,
        new THREE.Vector3(0, 0, -2)
      )
      nextMesh.scale.set(0.8, 0.8, 1)
      nextMesh.rotation.y = 0.3
      sceneRef.current.add(nextMesh)
      nextImageMeshRef.current = nextMesh

      // Animate camera movement (subtle rotation and position change)
      const camera = cameraRef.current!
      const cameraStartPos = camera.position.clone()
      const cameraStartRot = camera.rotation.clone()

      // Random subtle camera movement
      const cameraOffsetX = (Math.random() - 0.5) * 0.5
      const cameraOffsetY = (Math.random() - 0.5) * 0.3
      const cameraRotY = (Math.random() - 0.5) * 0.1

      // Exit animation for current image
      if (currentMesh) {
        const exitTimeline = gsap.timeline()
        exitTimeline.to(currentMesh.scale, {
          x: 0.8,
          y: 0.8,
          z: 1,
          duration: TRANSITION_DURATION,
          ease: "power2.inOut",
        })
        exitTimeline.to(
          currentMesh.rotation,
          {
            y: -0.3,
            duration: TRANSITION_DURATION,
            ease: "power2.inOut",
          },
          0
        )
        exitTimeline.to(
          currentMesh.position,
          {
            z: 2,
            duration: TRANSITION_DURATION,
            ease: "power2.inOut",
          },
          0
        )
        exitTimeline.to(
          (currentMesh.material as THREE.MeshBasicMaterial),
          {
            opacity: 0,
            duration: TRANSITION_DURATION * 0.8,
            ease: "power2.inOut",
          },
          0
        )
      }

      // Entrance animation for next image
      const entranceTimeline = gsap.timeline()
      entranceTimeline.to(nextMesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: TRANSITION_DURATION,
        ease: "power2.inOut",
      })
      entranceTimeline.to(
        nextMesh.rotation,
        {
          y: 0,
          duration: TRANSITION_DURATION,
          ease: "power2.inOut",
        },
        0
      )
      entranceTimeline.to(
        nextMesh.position,
        {
          z: 0,
          x: 0,
          y: 0,
          duration: TRANSITION_DURATION,
          ease: "power2.inOut",
        },
        0
      )
      entranceTimeline.to(
        (nextMesh.material as THREE.MeshBasicMaterial),
        {
          opacity: 1,
          duration: TRANSITION_DURATION * 0.8,
          ease: "power2.inOut",
        },
        TRANSITION_DURATION * 0.2
      )

      // Camera animation - simplified to reduce lag
      // Combine position and rotation into single timeline for better performance
      const cameraTimeline = gsap.timeline()
      cameraTimeline.to(
        camera.position,
        {
          x: cameraStartPos.x + cameraOffsetX,
          y: cameraStartPos.y + cameraOffsetY,
          z: cameraStartPos.z,
          duration: TRANSITION_DURATION,
          ease: "power2.inOut",
        },
        0
      )
      cameraTimeline.to(
        camera.rotation,
        {
          y: cameraStartRot.y + cameraRotY,
          duration: TRANSITION_DURATION,
          ease: "power2.inOut",
        },
        0
      )
      cameraTimeline.to(
        camera.position,
        {
          x: 0,
          y: 0,
          z: 5,
          duration: TRANSITION_DURATION * 0.5,
          ease: "power2.inOut",
        },
        TRANSITION_DURATION
      )
      cameraTimeline.to(
        camera.rotation,
        {
          y: 0,
          duration: TRANSITION_DURATION * 0.5,
          ease: "power2.inOut",
        },
        TRANSITION_DURATION
      )

      // Text animation
      if (textRef.current) {
        gsap.to(textRef.current, {
          opacity: 0,
          y: -20,
          duration: TRANSITION_DURATION * 0.5,
          ease: "power2.inOut",
          onComplete: () => {
            setCurrentImageInfo(nextImageInfo)
            setCurrentIndex(nextIndex)
            // Use setTimeout to ensure state update happens before animation
            setTimeout(() => {
              if (textRef.current) {
                gsap.fromTo(
                  textRef.current,
                  { opacity: 0, y: 20 },
                  {
                    opacity: 1,
                    y: 0,
                    duration: TRANSITION_DURATION * 0.5,
                    ease: "power2.inOut",
                  }
                )
              }
            }, 0)
          },
        })
      } else {
        // Update state even if textRef is not available
        setCurrentImageInfo(nextImageInfo)
        setCurrentIndex(nextIndex)
      }

      // Clean up old mesh after transition
      entranceTimeline.eventCallback("onComplete", () => {
        if (currentMesh && sceneRef.current) {
          try {
            sceneRef.current.remove(currentMesh)
            // Dispose geometry and material
            if (currentMesh.geometry) {
              currentMesh.geometry.dispose()
            }
            const material = currentMesh.material as THREE.MeshBasicMaterial
            if (material) {
              // Don't dispose cached textures - they're reused
              material.dispose()
            }
          } catch (cleanupError) {
            console.error("Error cleaning up mesh:", cleanupError)
          }
        }
        currentImageMeshRef.current = nextMesh
        nextImageMeshRef.current = null
        isTransitioningRef.current = false
        setIsTransitioning(false)
      })
    } catch (error) {
      console.error("Error transitioning to next image:", error, "Image index:", nextIndex)
      
      // Mark this image as failed
      failedImagesRef.current.add(nextIndex)
      
      // Clean up any partially created mesh
      if (nextImageMeshRef.current && sceneRef.current) {
        try {
          sceneRef.current.remove(nextImageMeshRef.current)
          nextImageMeshRef.current.geometry.dispose()
          const material = nextImageMeshRef.current.material as THREE.MeshBasicMaterial
          if (material) {
            material.dispose()
          }
        } catch (cleanupError) {
          console.error("Error cleaning up failed mesh:", cleanupError)
        }
        nextImageMeshRef.current = null
      }
      
      // Reset transitioning state
      isTransitioningRef.current = false
      setIsTransitioning(false)
      
      // The interval will automatically try the next valid image
      // No need to manually trigger transition here
      console.warn(`Image at index ${nextIndex} failed. Will skip and continue.`)
    }
    },
    [isTransitioning, imageList]
  )

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Dark blue gradient background
    scene.background = new THREE.Color(0x0a1628) // Dark blue
    scene.fog = new THREE.FogExp2(0x050810, 0.015) // Near-black fog

    // Camera setup
    const width = window.innerWidth
    const height = window.innerHeight
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 0, 5)
    cameraRef.current = camera

    // Renderer setup - optimized for performance
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false, // Disable antialiasing for better performance
      alpha: false,
      powerPreference: "high-performance",
      stencil: false, // Disable stencil buffer if not needed
      depth: true,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)) // Lower pixel ratio for better performance
    renderer.shadowMap.enabled = false // Disable shadows for better performance
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping // Disable tone mapping for performance
    rendererRef.current = renderer

    // Lighting setup - soft ambient + directional
    const ambientLight = new THREE.AmbientLight(0x4a6fa5, 0.4) // Soft blue ambient
    scene.add(ambientLight)
    ambientLightRef.current = ambientLight

    const directionalLight = new THREE.DirectionalLight(0x6b9bd4, 0.8) // Blue-white directional
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = false // Disable shadows for performance
    scene.add(directionalLight)
    directionalLightRef.current = directionalLight

    // Add subtle fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x3a5a8a, 0.3)
    fillLight.position.set(-5, -3, -5)
    fillLight.castShadow = false
    scene.add(fillLight)

    // Load and display first image
    const initializeFirstImage = async () => {
      try {
        const firstMesh = await createImagePlane(imageList[0].image)
        scene.add(firstMesh)
        currentImageMeshRef.current = firstMesh

        // Entrance animation for first image
        firstMesh.scale.set(0, 0, 1)
        firstMesh.rotation.y = 0.5
        ;(firstMesh.material as THREE.MeshBasicMaterial).opacity = 0

        gsap.to(firstMesh.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 1.5,
          ease: "power2.out",
        })
        gsap.to(firstMesh.rotation, {
          y: 0,
          duration: 1.5,
          ease: "power2.out",
        })
        gsap.to(firstMesh.material as THREE.MeshBasicMaterial, {
          opacity: 1,
          duration: 1.5,
          ease: "power2.out",
        })

        // Text entrance
        if (textRef.current) {
          gsap.fromTo(
            textRef.current,
            { opacity: 0, y: 30 },
            {
              opacity: 1,
              y: 0,
              duration: 1.5,
              ease: "power2.out",
              delay: 0.5,
            }
          )
        }
      } catch (error) {
        console.error("Error loading first image:", error)
      }
    }

    initializeFirstImage()

    // Animation loop - optimized with frame skipping for better performance
    let frameId: number
    let lastFrameTime = performance.now()
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS
    
    const animate = (currentTime: number) => {
      frameId = requestAnimationFrame(animate)
      
      const deltaTime = currentTime - lastFrameTime
      
      // Only render if enough time has passed (throttle to target FPS)
      if (deltaTime >= frameInterval) {
        // Create fireworks if needed
        if (showFireworks && !fireworksSystemRef.current && scene) {
          const particleCount = 500
          const geometry = new THREE.BufferGeometry()
          const positions = new Float32Array(particleCount * 3)
          const velocities = new Float32Array(particleCount * 3)
          const colors = new Float32Array(particleCount * 3)
          const sizes = new Float32Array(particleCount)
          
          // Initialize particles
          for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            
            // Random position around center
            positions[i3] = (Math.random() - 0.5) * 0.1
            positions[i3 + 1] = (Math.random() - 0.5) * 0.1
            positions[i3 + 2] = (Math.random() - 0.5) * 0.1
            
            // Random velocity
            const speed = 0.02 + Math.random() * 0.03
            const angle1 = Math.random() * Math.PI * 2
            const angle2 = Math.random() * Math.PI
            velocities[i3] = Math.sin(angle2) * Math.cos(angle1) * speed
            velocities[i3 + 1] = Math.cos(angle2) * speed
            velocities[i3 + 2] = Math.sin(angle2) * Math.sin(angle1) * speed
            
            // Random colors (red, blue, yellow, green, purple)
            const colorOptions = [
              [1, 0.2, 0.2], // Red
              [0.2, 0.4, 1], // Blue
              [1, 0.8, 0.2], // Yellow
              [0.2, 1, 0.4], // Green
              [0.8, 0.2, 1], // Purple
            ]
            const color = colorOptions[Math.floor(Math.random() * colorOptions.length)]
            colors[i3] = color[0]
            colors[i3 + 1] = color[1]
            colors[i3 + 2] = color[2]
            
            sizes[i] = Math.random() * 0.05 + 0.02
          }
          
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
          geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
          
          const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
          })
          
          const particles = new THREE.Points(geometry, material)
          particles.userData = { velocities, startTime: Date.now() }
          scene.add(particles)
          fireworksSystemRef.current = particles
          fireworksParticlesRef.current = positions
        }
        
        // Update fireworks if active
        if (fireworksSystemRef.current && showFireworks) {
          const particles = fireworksSystemRef.current
          const positions = particles.geometry.attributes.position.array as Float32Array
          const velocities = particles.userData.velocities as Float32Array
          const elapsed = (Date.now() - particles.userData.startTime) / 1000
          const fadeStart = 2
          const fadeEnd = 4
          
          for (let i = 0; i < positions.length; i += 3) {
            // Update position
            positions[i] += velocities[i] * deltaTime * 0.1
            positions[i + 1] += velocities[i + 1] * deltaTime * 0.1
            positions[i + 2] += velocities[i + 2] * deltaTime * 0.1
            
            // Apply gravity
            velocities[i + 1] -= 0.0001 * deltaTime
          }
          
          // Fade out over time
          if (elapsed > fadeStart) {
            const fade = Math.max(0, 1 - (elapsed - fadeStart) / (fadeEnd - fadeStart))
            if (particles.material instanceof THREE.PointsMaterial) {
              particles.material.opacity = fade
            }
          }
          
          particles.geometry.attributes.position.needsUpdate = true
          
          // Reset after fade out
          if (elapsed > fadeEnd) {
            particles.userData.startTime = Date.now()
            // Reset positions
            for (let i = 0; i < positions.length; i += 3) {
              positions[i] = (Math.random() - 0.5) * 0.1
              positions[i + 1] = (Math.random() - 0.5) * 0.1
              positions[i + 2] = (Math.random() - 0.5) * 0.1
            }
            if (particles.material instanceof THREE.PointsMaterial) {
              particles.material.opacity = 1
            }
          }
        }
        
        if (renderer && scene && camera) {
          renderer.render(scene, camera)
        }
        lastFrameTime = currentTime - (deltaTime % frameInterval)
      }
    }
    animate(performance.now())

    // Handle resize
    const handleResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(frameId)

      // Dispose textures
      imageTexturesRef.current.forEach((texture) => {
        texture.dispose()
      })
      imageTexturesRef.current.clear()

      // Dispose geometries and materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const material = object.material as THREE.MeshBasicMaterial
          if (material.map && !imageTexturesRef.current.has(material.map.uuid)) {
            material.map.dispose()
          }
          material.dispose()
        }
      })

      renderer.dispose()
    }
  }, [])

  // Helper to find next valid image index (skip failed ones)
  const getNextValidIndex = useCallback((startIndex: number): number => {
    let attempts = 0
    let nextIndex = (startIndex + 1) % imageList.length
    
    // Try to find a valid image (not in failed set)
    while (failedImagesRef.current.has(nextIndex) && attempts < imageList.length) {
      nextIndex = (nextIndex + 1) % imageList.length
      attempts++
    }
    
    return nextIndex
  }, [imageList.length])

  // Timer to stop at winner image after 20 seconds
  useEffect(() => {
    if (isStopped || WINNER_INDEX === -1) return

    const timer = setTimeout(() => {
      // Transition to winner image
      if (currentIndex !== WINNER_INDEX && !isTransitioning) {
        transitionToNext(WINNER_INDEX)
      }
      
      // Stop slideshow and show fireworks
      setTimeout(() => {
        setIsStopped(true)
        setShowFireworks(true)
        // Fireworks will be created in the animation loop when showFireworks is true
      }, TRANSITION_DURATION * 1000 + 500)
    }, STOP_AFTER_MS)

    return () => clearTimeout(timer)
  }, [currentIndex, isTransitioning, isStopped, WINNER_INDEX, transitionToNext])

  // Auto-advance slideshow - separate effect for interval management
  useEffect(() => {
    if (imageList.length === 0 || isStopped) return

    const intervalId = setInterval(() => {
      // Check both state and ref to avoid race conditions
      if (!isTransitioningRef.current && !isTransitioning && !isStopped) {
        const nextIndex = getNextValidIndex(currentIndex)
        transitionToNext(nextIndex)
      }
    }, IMAGE_DURATION)

    return () => clearInterval(intervalId)
  }, [currentIndex, isTransitioning, isStopped, imageList.length, transitionToNext, getNextValidIndex])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #0a1628 0%, #050810 50%, #020408 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          willChange: "transform",
          transform: "translateZ(0)", // Force GPU acceleration
        }}
      />

      {/* Text overlay */}
      <div
        ref={textRef}
        className="absolute bottom-0 left-0 right-0 z-10 px-6 md:px-12 pb-8 md:pb-12 text-center pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(5, 8, 16, 0.95) 0%, rgba(5, 8, 16, 0.7) 40%, rgba(5, 8, 16, 0.3) 70%, transparent 100%)",
        }}
      >
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Description - ở trên với style khác nhau cho tiếng Việt và tiếng Nhật */}
          {currentImageInfo.description && (() => {
            const descriptionParts = currentImageInfo.description.split('\n')
            const vietnameseText = descriptionParts[0] || ''
            const japaneseText = descriptionParts[1] || ''
            
            return (
              <div className="mb-6 space-y-4">
                {/* Tiếng Việt - Style lớn hơn, bold hơn, có gradient */}
                {vietnameseText && (
                  <div className="mb-3">
                    <p
                      className="text-xl md:text-2xl lg:text-3xl font-bold"
                      style={{
                        background:
                          "linear-gradient(135deg, #ffffff 0%, #e0e7ff 40%, #c7d2fe 70%,rgb(102, 116, 186) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        textShadow:
                          "0 2px 15px rgba(130, 147, 234, 0.95), 0 4px 25px rgba(102, 155, 225, 0.85), 0 0 50px rgba(130, 147, 234, 0.4), 0 0 80px rgba(133, 180, 240, 0.25)",
                        letterSpacing: "-0.01em",
                        lineHeight: "1.5",
                        filter: "drop-shadow(0 3px 10px rgba(0, 0, 0, 0.7))",
                      }}
                    >
                      {vietnameseText}
                    </p>
                  </div>
                )}
              
                
                {/* Tiếng Nhật - Style nhỏ hơn, elegant hơn, màu khác, có glow effect */}
                {japaneseText && (
                  <div className="mt-2">
                    <p
                      className="text-base md:text-lg lg:text-2xl font-light text-gray-200"
                      style={{
                        textShadow:
                          "0 1px 8px rgba(0, 0, 0, 0.95), 0 2px 15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.3), 0 0 50px rgba(167, 139, 250, 0.2)",
                        letterSpacing: "0.08em",
                        lineHeight: "1.8",
                        fontStyle: "normal",
                        opacity: 0.95,
                        fontFamily: "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif",
                      }}
                    >
                      {japaneseText}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Actor name - ở dưới với gradient đẹp */}
          {currentImageInfo.actor && (
            <div className="mt-6">
              <h2
                className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight"
                style={{
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #e0e7ff 30%, #c7d2fe 60%, #a5b4fc 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow:
                    "0 0 40px rgba(167, 139, 250, 0.5), 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 60px rgba(99, 102, 241, 0.3)",
                  filter: "drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5))",
                  letterSpacing: "-0.02em",
                }}
              >
                {currentImageInfo.actor}
              </h2>
            </div>
          )}

          {/* Progress indicator - ở dưới cùng */}
          <div className="mt-8 md:mt-10 flex justify-center gap-2">
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
    </div>
  )
}

export default ImageSlider
export { IMAGES_INFO }
