import gsap from "gsap"
import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import * as THREE from "three"
import { useGoogleAuth } from "../utils/googleAuth"
import { getSelectedNumbers, saveNumberToSheet } from "../utils/googleSheets"

interface HeroProps {
  isDarkMode: boolean
}

interface NumberCell {
  number: number
  mesh: THREE.Mesh | null
  isSelected: boolean
  isDisabled: boolean
}

const Hero: React.FC<HeroProps> = ({ isDarkMode }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Store refs for cleanup and animation
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const segmentsRef = useRef<THREE.Group[]>([])
  const scrollPosRef = useRef(0)
  const raycasterRef = useRef<THREE.Raycaster | null>(null)
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const numberCellsRef = useRef<Map<number, NumberCell>>(new Map())
  const hoveredCellRef = useRef<THREE.Mesh | null>(null)
  const isHoveringRef = useRef(false)
  const autoScrollSpeedRef = useRef(0.8) // Auto-scroll speed (pixels per frame)

  // State
  const [loading, setLoading] = useState(true)
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [userHasSelected, setUserHasSelected] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogStatus, setDialogStatus] = useState<
    "confirm" | "success" | "error"
  >("confirm")
  const dialogRef = useRef<HTMLDivElement>(null)
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    login,
    logout,
    userName,
    authError,
  } = useGoogleAuth()
  const [userSelectedNumber, setUserSelectedNumber] = useState<number | null>(
    null
  )

  // Google Sheets config (set these in environment variables)
  const GOOGLE_SHEETS_CONFIG = {
    spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_ID || "",
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || "",
    scriptUrl: import.meta.env.VITE_GOOGLE_SCRIPT_URL || "",
  }

  // --- CONFIGURATION ---
  // Tuned to match the reference design's density and scale
  const TUNNEL_WIDTH = 24
  const TUNNEL_HEIGHT = 16
  const SEGMENT_DEPTH = 6 // Short depth for "square-ish" floor tiles
  const NUM_SEGMENTS = 14
  const FOG_DENSITY = 0.02

  // Grid Divisions
  const FLOOR_COLS = 6 // Number of columns on floor/ceiling
  const WALL_ROWS = 4 // Number of rows on walls

  // Derived dimensions
  const COL_WIDTH = TUNNEL_WIDTH / FLOOR_COLS
  const ROW_HEIGHT = TUNNEL_HEIGHT / WALL_ROWS

  // Helper: Create text texture for number
  const createNumberTexture = (
    number: number,
    isDisabled: boolean
  ): THREE.CanvasTexture => {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")!
    canvas.width = 512
    canvas.height = 512

    // Clear canvas with transparent background
    context.clearRect(0, 0, canvas.width, canvas.height)

    // Draw number on canvas
    context.fillStyle = isDisabled
      ? isDarkMode
        ? "#F63049"
        : "#cccccc"
      : isDarkMode
      ? "#00F7FF"
      : "#000000"

    // Use a beautiful modern font - Space Grotesk for numbers (geometric and clean)
    // Fallback to JetBrains Mono (monospace) or system fonts
    context.font =
      "700 190px 'Space Grotesk', 'JetBrains Mono', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace"
    context.textAlign = "center"
    context.textBaseline = "middle"

    // Add subtle text shadow for depth and readability
    context.shadowColor = isDisabled
      ? isDarkMode
        ? "rgba(246, 48, 73, 0.4)"
        : "rgba(0, 0, 0, 0.25)"
      : isDarkMode
      ? "rgba(0, 247, 255, 0.5)"
      : "rgba(0, 0, 0, 0.2)"
    context.shadowBlur = 10
    context.shadowOffsetX = 3
    context.shadowOffsetY = 3

    // Pad number with zeros (001, 002, ..., 100)
    const paddedNumber = number.toString().padStart(3, "0")
    context.fillText(paddedNumber, 256, 256)

    // Reset shadow
    context.shadowColor = "transparent"
    context.shadowBlur = 0
    context.shadowOffsetX = 0
    context.shadowOffsetY = 0

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    return texture
  }

  // Helper: Create number mesh with plane and text
  const createNumberMesh = (
    number: number,
    pos: THREE.Vector3,
    rot: THREE.Euler,
    wd: number,
    ht: number,
    isDisabled: boolean
  ): THREE.Group => {
    const group = new THREE.Group()

    // Create plane background
    const bgGeom = new THREE.PlaneGeometry(wd * 0.8, ht * 0.8)
    const bgMat = new THREE.MeshBasicMaterial({
      color: isDisabled
        ? isDarkMode
          ? 0x333333
          : 0xeeeeee
        : isDarkMode
        ? 0x222222
        : 0xf5f5f5,
      transparent: true,
      opacity: isDisabled ? 0.3 : 0.7,
      side: THREE.DoubleSide,
    })
    const bgPlane = new THREE.Mesh(bgGeom, bgMat)
    group.add(bgPlane)

    // Create number texture plane
    const numberTexture = createNumberTexture(number, isDisabled)
    const numberGeom = new THREE.PlaneGeometry(wd * 0.6, ht * 0.6)
    const numberMat = new THREE.MeshBasicMaterial({
      map: numberTexture,
      transparent: true,
      opacity: isDisabled ? 0.6 : 1.0,
      side: THREE.DoubleSide,
      alphaTest: 0.1,
    })
    const numberPlane = new THREE.Mesh(numberGeom, numberMat)
    numberPlane.position.z = 0.01
    group.add(numberPlane)

    group.position.copy(pos)
    group.rotation.copy(rot)
    group.userData = { number, isDisabled, type: "numberCell" }

    return group
  }

  // Helper: Create a segment with grid lines and filled cells
  const createSegment = (zPos: number) => {
    const group = new THREE.Group()
    group.position.z = zPos

    const w = TUNNEL_WIDTH / 2
    const h = TUNNEL_HEIGHT / 2
    const d = SEGMENT_DEPTH

    // --- 1. Grid Lines ---
    // Start with default light mode colors; these will be updated by useEffect immediately on mount
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xb0b0b0,
      transparent: true,
      opacity: 0.5,
    })
    const lineGeo = new THREE.BufferGeometry()
    const vertices: number[] = []

    // A. Longitudinal Lines (Z-axis)
    // Floor & Ceiling (varying X)
    for (let i = 0; i <= FLOOR_COLS; i++) {
      const x = -w + i * COL_WIDTH
      // Floor line
      vertices.push(x, -h, 0, x, -h, -d)
      // Ceiling line
      vertices.push(x, h, 0, x, h, -d)
    }
    // Walls (varying Y) - excluding top/bottom corners already drawn
    for (let i = 1; i < WALL_ROWS; i++) {
      const y = -h + i * ROW_HEIGHT
      // Left Wall line
      vertices.push(-w, y, 0, -w, y, -d)
      // Right Wall line
      vertices.push(w, y, 0, w, y, -d)
    }

    // B. Latitudinal Lines (Ring at z=0)
    // Floor (Bottom edge)
    vertices.push(-w, -h, 0, w, -h, 0)
    // Ceiling (Top edge)
    vertices.push(-w, h, 0, w, h, 0)
    // Left Wall (Left edge)
    vertices.push(-w, -h, 0, -w, h, 0)
    // Right Wall (Right edge)
    vertices.push(w, -h, 0, w, h, 0)

    lineGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    )
    const lines = new THREE.LineSegments(lineGeo, lineMaterial)
    group.add(lines)

    // Initial population of numbers
    populateNumbers(group, w, h, d, zPos)

    return group
  }

  // Helper: Populate numbers in a segment (1-100 infinite loop)
  const populateNumbers = (
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    zPos: number
  ) => {
    // First, remove all existing number meshes from this group
    const toRemove: THREE.Object3D[] = []
    group.traverse((child) => {
      if (child.name?.startsWith("number_")) {
        toRemove.push(child)
      }
    })
    toRemove.forEach((obj) => {
      group.remove(obj)
      if (obj instanceof THREE.Group) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (child.material instanceof THREE.Material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                  if (mat.map) mat.map.dispose()
                  mat.dispose()
                })
              } else {
                if (child.material.map) child.material.map.dispose()
                child.material.dispose()
              }
            }
          }
        })
      }
    })

    // Calculate which numbers to show based on segment position
    // Each segment gets a range of numbers, cycling through 1-100
    const segmentIndex = Math.floor(Math.abs(zPos) / SEGMENT_DEPTH)
    const totalCells = FLOOR_COLS * 2 + WALL_ROWS * 2 // Floor + Ceiling + Left + Right
    const startNumber = ((segmentIndex * totalCells) % 100) + 1
    let currentNumber = startNumber

    const addNumber = (
      pos: THREE.Vector3,
      rot: THREE.Euler,
      wd: number,
      ht: number,
      number: number
    ) => {
      const cell = numberCellsRef.current.get(number)
      const isDisabled = cell?.isDisabled || false

      // Create unique name for this instance
      const uniqueName = `number_${number}_seg_${segmentIndex}_${pos.x}_${pos.y}_${pos.z}`
      const numberGroup = createNumberMesh(number, pos, rot, wd, ht, isDisabled)
      numberGroup.name = uniqueName
      group.add(numberGroup)

      // Store reference only for the first instance of each number
      if (!numberCellsRef.current.has(number)) {
        numberCellsRef.current.set(number, {
          number,
          mesh: numberGroup,
          isSelected: false,
          isDisabled,
        })
      }

      // Increment number, wrapping around 1-100
      currentNumber = currentNumber >= 100 ? 1 : currentNumber + 1
    }

    // Floor - populate with numbers (one per cell)
    for (let i = 0; i < FLOOR_COLS; i++) {
      addNumber(
        new THREE.Vector3(-w + i * COL_WIDTH + COL_WIDTH / 2, -h, -d / 2),
        new THREE.Euler(-Math.PI / 2, 0, 0),
        COL_WIDTH,
        d,
        currentNumber
      )
    }

    // Ceiling - populate with numbers (one per cell)
    for (let i = 0; i < FLOOR_COLS; i++) {
      addNumber(
        new THREE.Vector3(-w + i * COL_WIDTH + COL_WIDTH / 2, h, -d / 2),
        new THREE.Euler(Math.PI / 2, 0, 0),
        COL_WIDTH,
        d,
        currentNumber
      )
    }

    // Left Wall - populate with numbers (one per cell)
    for (let i = 0; i < WALL_ROWS; i++) {
      addNumber(
        new THREE.Vector3(-w, -h + i * ROW_HEIGHT + ROW_HEIGHT / 2, -d / 2),
        new THREE.Euler(0, Math.PI / 2, 0),
        d,
        ROW_HEIGHT,
        currentNumber
      )
    }

    // Right Wall - populate with numbers (one per cell)
    for (let i = 0; i < WALL_ROWS; i++) {
      addNumber(
        new THREE.Vector3(w, -h + i * ROW_HEIGHT + ROW_HEIGHT / 2, -d / 2),
        new THREE.Euler(0, -Math.PI / 2, 0),
        d,
        ROW_HEIGHT,
        currentNumber
      )
    }
  }

  // --- INITIAL SETUP ---
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    // THREE JS SETUP
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const width = window.innerWidth
    const height = window.innerHeight
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
    camera.position.set(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer

    // Setup raycaster for mouse interaction
    const raycaster = new THREE.Raycaster()
    raycasterRef.current = raycaster

    // Generate segments
    const segments: THREE.Group[] = []
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const z = -i * SEGMENT_DEPTH
      const segment = createSegment(z)
      scene.add(segment)
      segments.push(segment)
    }
    segmentsRef.current = segments

    // Function to update disabled numbers from Google Sheets
    const updateDisabledNumbers = async () => {
      if (
        !GOOGLE_SHEETS_CONFIG.spreadsheetId ||
        !GOOGLE_SHEETS_CONFIG.apiKey ||
        userHasSelected ||
        !isAuthenticated
      ) {
        return
      }

      try {
        const { numbers, userNameNumbers } = await getSelectedNumbers(
          GOOGLE_SHEETS_CONFIG
        )
        setLoading(false)

        const newDisabledNumbers = new Set(numbers)

        // Check if current user has already selected a number
        if (userName && userNameNumbers.has(userName)) {
          const userSelectedNum = userNameNumbers.get(userName)!
          setUserSelectedNumber(userSelectedNum)
          setUserHasSelected(true)
          setSelectedNumber(userSelectedNum)

          // Disable all numbers since user has already selected
          numberCellsRef.current.forEach((cell) => {
            cell.isDisabled = true
            if (cell.mesh) {
              cell.mesh.userData.isDisabled = true
            }
          })

          // Update all segments to disable all numbers
          if (sceneRef.current) {
            sceneRef.current.traverse((obj) => {
              if (obj.userData.type === "numberCell") {
                obj.userData.isDisabled = true
                obj.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    const material = child.material
                    if (material instanceof THREE.MeshBasicMaterial) {
                      if (!material.map) {
                        material.color.setHex(isDarkMode ? 0x333333 : 0xeeeeee)
                        material.opacity = 0.3
                      } else {
                        material.opacity = 0.6
                        const num = obj.userData.number
                        const oldTexture = material.map
                        const newTexture = createNumberTexture(num, true)
                        material.map = newTexture
                        if (oldTexture) {
                          oldTexture.dispose()
                        }
                      }
                      material.needsUpdate = true
                    }
                  }
                })
              }
            })
          }
        }

        // Update number cells and their visual appearance
        newDisabledNumbers.forEach((num) => {
          const cell = numberCellsRef.current.get(num)
          if (cell) {
            // Only update if it wasn't disabled before
            if (!cell.isDisabled) {
              cell.isDisabled = true

              // Update the mesh visual appearance if it exists
              if (cell.mesh && sceneRef.current) {
                // Update userData first
                cell.mesh.userData.isDisabled = true

                // Traverse and update all child meshes
                cell.mesh.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    const material = child.material
                    if (material instanceof THREE.MeshBasicMaterial) {
                      // Update background plane (no texture)
                      if (!material.map) {
                        material.color.setHex(isDarkMode ? 0x333333 : 0xeeeeee)
                        material.opacity = 0.3
                        material.needsUpdate = true
                      } else {
                        // Update number texture plane
                        material.opacity = 0.6
                        // Create and update texture
                        const oldTexture = material.map
                        const newTexture = createNumberTexture(num, true)
                        material.map = newTexture
                        material.needsUpdate = true
                        // Dispose old texture
                        if (oldTexture) {
                          oldTexture.dispose()
                        }
                      }
                    }
                  }
                })
              }
            }
          } else {
            // Create new entry for disabled number
            numberCellsRef.current.set(num, {
              number: num,
              mesh: null,
              isSelected: false,
              isDisabled: true,
            })
          }
        })

        // Also update all segments to reflect disabled state for newly created numbers
        segmentsRef.current.forEach((segment) => {
          segment.traverse((obj) => {
            if (obj.userData.type === "numberCell") {
              const num = obj.userData.number
              if (newDisabledNumbers.has(num) && !obj.userData.isDisabled) {
                obj.userData.isDisabled = true
                // Update visual appearance
                obj.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    const material = child.material
                    if (material instanceof THREE.MeshBasicMaterial) {
                      if (!material.map) {
                        material.color.setHex(isDarkMode ? 0x333333 : 0xeeeeee)
                        material.opacity = 0.3
                      } else {
                        material.opacity = 0.6
                        const oldTexture = material.map
                        const newTexture = createNumberTexture(num, true)
                        material.map = newTexture
                        if (oldTexture) {
                          oldTexture.dispose()
                        }
                      }
                      material.needsUpdate = true
                    }
                  }
                })
              }
            }
          })
        })
      } catch (error) {
        console.error("Error updating disabled numbers:", error)
      }
    }

    if (isAuthenticated && userName) {
      updateDisabledNumbers()
    }
    // Set up interval to check for new disabled numbers every 6 seconds
    const intervalId = setInterval(updateDisabledNumbers, 10000)

    // Mouse move handler for hover
    const onMouseMove = (event: MouseEvent) => {
      if (showDialog || loading || !isAuthenticated) return

      mouseRef.current.x = (event.clientX / width) * 2 - 1
      mouseRef.current.y = -(event.clientY / height) * 2 + 1

      raycaster.setFromCamera(mouseRef.current, camera)
      const intersects = raycaster.intersectObjects(scene.children, true)

      // Find hovered number cell
      let currentHovered: THREE.Object3D | null = null
      for (const intersect of intersects) {
        const obj = intersect.object
        // Check if it's a number cell group or a child of one
        let numberGroup: THREE.Object3D | null = null
        if (obj.userData.type === "numberCell") {
          numberGroup = obj
        } else {
          // Check parent
          let parent = obj.parent
          while (parent) {
            if (parent.userData.type === "numberCell") {
              numberGroup = parent
              break
            }
            parent = parent.parent
          }
        }

        if (
          numberGroup &&
          !numberGroup.userData.isDisabled &&
          !userHasSelected
        ) {
          currentHovered = numberGroup
          break
        }
      }

      // Only update if hovering over a different cell
      if (currentHovered !== hoveredCellRef.current) {
        // Reset previous hover
        if (hoveredCellRef.current) {
          gsap.to(hoveredCellRef.current.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.15,
          })
        }

        // Set new hover
        hoveredCellRef.current = currentHovered as THREE.Group | null
        if (hoveredCellRef.current) {
          isHoveringRef.current = true
          gsap.to(hoveredCellRef.current.scale, {
            x: 1.2,
            y: 1.2,
            z: 1.2,
            duration: 0.15,
          })
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "pointer"
          }
        } else {
          isHoveringRef.current = false
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "default"
          }
        }
      }
    }

    // Mouse click handler
    const onMouseClick = (event: MouseEvent) => {
      if (userHasSelected || showDialog || loading || !isAuthenticated) return

      mouseRef.current.x = (event.clientX / width) * 2 - 1
      mouseRef.current.y = -(event.clientY / height) * 2 + 1

      raycaster.setFromCamera(mouseRef.current, camera)
      const intersects = raycaster.intersectObjects(scene.children, true)

      for (const intersect of intersects) {
        const obj = intersect.object
        // Check if it's a number cell group or a child of one
        let numberGroup: THREE.Object3D | null = null
        if (obj.userData.type === "numberCell") {
          numberGroup = obj
        } else {
          // Check parent
          let parent = obj.parent
          while (parent) {
            if (parent.userData.type === "numberCell") {
              numberGroup = parent
              break
            }
            parent = parent.parent
          }
        }

        if (numberGroup && !numberGroup.userData.isDisabled) {
          const number = numberGroup.userData.number
          handleNumberSelect(number)
          break
        }
      }
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("click", onMouseClick)

    // Animation Loop
    let frameId: number
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (!cameraRef.current || !sceneRef.current || !rendererRef.current)
        return

      // Auto-scroll: slowly increase scroll position when not hovering
      if (!isHoveringRef.current) {
        scrollPosRef.current += autoScrollSpeedRef.current
      }

      const targetZ = -scrollPosRef.current * 0.05
      const currentZ = cameraRef.current.position.z
      cameraRef.current.position.z += (targetZ - currentZ) * 0.1

      // Bidirectional Infinite Logic
      const tunnelLength = NUM_SEGMENTS * SEGMENT_DEPTH

      const camZ = cameraRef.current.position.z

      segmentsRef.current.forEach((segment) => {
        // 1. Moving Forward
        if (segment.position.z > camZ + SEGMENT_DEPTH) {
          let minZ = 0
          segmentsRef.current.forEach(
            (s) => (minZ = Math.min(minZ, s.position.z))
          )
          segment.position.z = minZ - SEGMENT_DEPTH

          // Re-populate (cleanup is handled inside populateNumbers)
          const w = TUNNEL_WIDTH / 2
          const h = TUNNEL_HEIGHT / 2
          const d = SEGMENT_DEPTH
          populateNumbers(segment, w, h, d, segment.position.z)
        }

        // 2. Moving Backward
        if (segment.position.z < camZ - tunnelLength - SEGMENT_DEPTH) {
          let maxZ = -999999
          segmentsRef.current.forEach(
            (s) => (maxZ = Math.max(maxZ, s.position.z))
          )
          segment.position.z = maxZ + SEGMENT_DEPTH

          // Re-populate (cleanup is handled inside populateNumbers)
          const w = TUNNEL_WIDTH / 2
          const h = TUNNEL_HEIGHT / 2
          const d = SEGMENT_DEPTH
          populateNumbers(segment, w, h, d, segment.position.z)
        }
      })

      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
    animate()

    const onScroll = () => {
      scrollPosRef.current = window.scrollY
    }
    window.addEventListener("scroll", onScroll)

    // Also allow mouse wheel to control scroll
    const onWheel = (event: WheelEvent) => {
      if (!showDialog) {
        scrollPosRef.current += event.deltaY * 0.5
        // Prevent default scrolling behavior
        event.preventDefault()
      }
    }
    window.addEventListener("wheel", onWheel, { passive: false })

    const handleResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("click", onMouseClick)
      clearInterval(intervalId)
      cancelAnimationFrame(frameId)
      renderer.dispose()
    }
  }, [showDialog, isAuthenticated, userName, loading]) // Run when auth state changes

  // Handle number selection
  const handleNumberSelect = async (number: number) => {
    // Check if user has already selected (by IP or localStorage)
    if (userHasSelected || userSelectedNumber) {
      setDialogStatus("error")
      setShowDialog(true)
      // Animate dialog in
      if (dialogRef.current) {
        gsap.fromTo(
          dialogRef.current,
          { opacity: 0, scale: 0.8, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }
        )
      }
      return
    }

    const cell = numberCellsRef.current.get(number)
    if (cell?.isDisabled) {
      setDialogStatus("error")
      setShowDialog(true)
      // Animate dialog in
      if (dialogRef.current) {
        gsap.fromTo(
          dialogRef.current,
          { opacity: 0, scale: 0.8, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }
        )
      }
      return
    }

    setSelectedNumber(number)
    setDialogStatus("confirm")
    setShowDialog(true)

    // Animate dialog in
    if (dialogRef.current) {
      gsap.fromTo(
        dialogRef.current,
        { opacity: 0, scale: 0.8, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }
      )
    }

    // Visual feedback
    if (cell?.mesh) {
      gsap.to(cell.mesh.scale, {
        x: 1.3,
        y: 1.3,
        z: 1.3,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
      })
    }
  }

  // --- THEME UPDATE EFFECT ---
  useEffect(() => {
    if (!sceneRef.current) return

    // Define theme colors
    const bgHex = isDarkMode ? 0x050505 : 0xffffff
    const fogHex = isDarkMode ? 0x050505 : 0xffffff

    // Light mode: Light Grey lines (0xb0b0b0), higher opacity
    // Dark mode: Medium Grey lines (0x555555) for visibility, slightly adjusted opacity
    const lineHex = isDarkMode ? 0x555555 : 0xb0b0b0
    const lineOp = isDarkMode ? 0.35 : 0.5

    // Apply to scene
    sceneRef.current.background = new THREE.Color(bgHex)
    if (sceneRef.current.fog) {
      ;(sceneRef.current.fog as THREE.FogExp2).color.setHex(fogHex)
    }

    // Apply to existing grid lines
    segmentsRef.current.forEach((segment) => {
      segment.children.forEach((child) => {
        if (child instanceof THREE.LineSegments) {
          const mat = child.material as THREE.LineBasicMaterial
          mat.color.setHex(lineHex)
          mat.opacity = lineOp
          mat.needsUpdate = true
        }
      })
    })
  }, [])

  // Text Entrance Animation
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: "power3.out",
          delay: 0.5,
        }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div
        ref={containerRef}
        className={`relative w-full h-[10000vh] transition-colors duration-700 ${
          isDarkMode ? "bg-[#050505]" : "bg-white"
        }`}
      >
        <div className="fixed inset-0 w-full h-full overflow-hidden z-0">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div
            ref={contentRef}
            className="text-center flex flex-col items-center max-w-3xl px-6"
          >
            {!isAuthenticated && !authLoading ? (
              <div className="flex flex-col items-center gap-6">
                <h1
                  className={`relative text-[2rem] md:text-[2rem] lg:text-[3rem] leading-[0.9] font-black tracking-[-0.02em] mb-4 transition-all duration-700 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                  style={{
                    background: isDarkMode
                      ? "linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%,rgb(86, 175, 111) 100%)"
                      : "linear-gradient(135deg, #2563eb 0%,rgb(170, 138, 225) 50%,rgb(11, 229, 69) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textShadow: isDarkMode
                      ? "0 0 40px rgba(59, 130, 246, 0.6), 0 0 80px rgba(147, 51, 234, 0.4)"
                      : "0 2px 10px rgba(0, 0, 0, 0.1)",
                    letterSpacing: "-0.03em",
                    filter: isDarkMode
                      ? "drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))"
                      : "none",
                  }}
                >
                  Select Your Lucky Number
                </h1>
                <p
                  className={`text-lg mb-4 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Please sign in with Google to continue
                </p>
                <button
                  onClick={login}
                  className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:scale-105 pointer-events-auto bg-blue-200 ${
                    isDarkMode
                      ? "bg-white text-gray-900 hover:bg-gray-100"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </div>
                </button>
                {authError && (
                  <div
                    className={`mt-4 px-4 py-3 rounded-lg max-w-md text-center ${
                      isDarkMode
                        ? "bg-red-900/30 border border-red-500/50 text-red-300"
                        : "bg-red-50 border border-red-200 text-red-700"
                    }`}
                  >
                    <p className="text-sm font-medium">{authError}</p>
                  </div>
                )}
              </div>
            ) : authLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin ${
                    isDarkMode ? "border-blue-500" : "border-blue-600"
                  }`}
                />
                <p
                  className={`text-lg ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Loading...
                </p>
              </div>
            ) : (
              <>
                <h1
                  className={`relative text-[2rem] md:text-[2rem] lg:text-[3rem] leading-[0.9] font-black tracking-[-0.02em] mb-8 transition-all duration-700 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                  style={{
                    background: isDarkMode
                      ? "linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%,rgb(86, 175, 111) 100%)"
                      : "linear-gradient(135deg, #2563eb 0%,rgb(170, 138, 225) 50%,rgb(11, 229, 69) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textShadow: isDarkMode
                      ? "0 0 40px rgba(59, 130, 246, 0.6), 0 0 80px rgba(147, 51, 234, 0.4)"
                      : "0 2px 10px rgba(0, 0, 0, 0.1)",
                    letterSpacing: "-0.03em",
                    filter: isDarkMode
                      ? "drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))"
                      : "none",
                  }}
                >
                  {userHasSelected && userSelectedNumber ? (
                    <>
                      🎉 Your Lucky Number is{" "}
                      {userSelectedNumber?.toString().padStart(3, "0")} 🎉
                    </>
                  ) : (
                    "Select Your Lucky Number"
                  )}
                </h1>
              </>
            )}
          </div>
        </div>
      </div>
      {/* User Info and Logout Button - Bottom Right */}
      {isAuthenticated && userName && (
        <div className="fixed bottom-10 right-6 z-20 pointer-events-auto">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-300 ${
              isDarkMode
                ? "bg-gray-900/80 border border-gray-700"
                : "bg-white/80 border border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isDarkMode
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-blue-500/10 text-blue-600"
                }`}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              <span
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-200" : "text-gray-800"
                }`}
              >
                {userName}
              </span>
            </div>
            <button
              onClick={logout}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 hover:scale-105 ${
                isDarkMode
                  ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                  : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
              }`}
            >
              Logout
            </button>
          </div>
        </div>
      )}
      {/* Confirmation Dialog */}
      {showDialog && selectedNumber && (
        <div
          ref={dialogRef}
          className={`fixed h-screen w-screen top-0 left-0 z-50 flex items-center justify-center pointer-events-auto ${
            isDarkMode ? "bg-black/20" : "bg-black/40"
          } backdrop-blur-sm`}
          onClick={(e) => {
            // Close on backdrop click only if error
            if (e.target === e.currentTarget && dialogStatus === "error") {
              setShowDialog(false)
            }
          }}
        >
          <div
            className={`relative w-full max-w-md mx-4 bg-opacity-80 rounded-2xl shadow-2xl overflow-hidden ${
              dialogStatus === "success"
                ? isDarkMode
                  ? "bg-gradient-to-br from-green-900/90 to-emerald-900/90 border-2 border-green-500"
                  : "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400"
                : dialogStatus === "error"
                ? isDarkMode
                  ? "bg-gradient-to-br from-red-900/90 to-rose-900/90 border-2 border-red-500"
                  : "bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-400"
                : isDarkMode
                ? "bg-gradient-to-br from-blue-900/90 to-indigo-900/90 border-2 border-blue-500"
                : "bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated background glow */}
            <div
              className={`absolute inset-0 opacity-20 ${
                dialogStatus === "success"
                  ? "bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 animate-pulse"
                  : dialogStatus === "error"
                  ? "bg-gradient-to-r from-red-400 via-rose-400 to-red-400"
                  : "bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400"
              }`}
              style={{
                backgroundSize: "200% 200%",
                animation:
                  dialogStatus === "confirm"
                    ? "gradient 3s ease infinite"
                    : "none",
              }}
            />

            <div className="relative z-10 p-8 text-center">
              {dialogStatus === "confirm" && (
                <>
                  <img
                    src="/kozocom-logo.png"
                    alt="Logo"
                    className="w-60 h-20 mb-2 block mx-auto"
                  />
                  <div className="mb-6">
                    <div
                      className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center text-6xl font-bold ${
                        isDarkMode
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-blue-500/10 text-blue-600"
                      }`}
                    >
                      {selectedNumber?.toString().padStart(3, "0")}
                    </div>
                  </div>
                  <h2
                    className={`text-2xl font-bold mb-4 ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Confirm Your Selection
                  </h2>

                  <p
                    className={`text-sm mb-6 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Are you sure you want to select this number?
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => {
                        setShowDialog(false)
                        setSelectedNumber(null)
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                        isDarkMode
                          ? "bg-gray-700 text-white hover:bg-gray-600"
                          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedNumber) return
                        setIsSubmitting(true)

                        // Save to Google Sheets
                        try {
                          if (GOOGLE_SHEETS_CONFIG.scriptUrl) {
                            // INSERT_YOUR_CODE
                            // Before saving, check if the number is already in Google Sheet (avoid double-select)
                            const { numbers } = await getSelectedNumbers(
                              GOOGLE_SHEETS_CONFIG
                            )
                            if (numbers.includes(selectedNumber)) {
                              setIsSubmitting(false)
                              setDialogStatus("error")
                              setShowDialog(true)
                              // Optionally provide feedback ("Number already taken")
                              return
                            }

                            if (!userName) {
                              setIsSubmitting(false)
                              setDialogStatus("error")
                              setShowDialog(true)
                              return
                            }

                            const result = await saveNumberToSheet(
                              selectedNumber,
                              userName,
                              {
                                scriptUrl: GOOGLE_SHEETS_CONFIG.scriptUrl,
                              }
                            )

                            if (result.success) {
                              setUserHasSelected(true)
                              setDialogStatus("success")

                              // Animate success transition
                              if (dialogRef.current) {
                                gsap.to(dialogRef.current, {
                                  scale: 1.05,
                                  duration: 0.2,
                                  yoyo: true,
                                  repeat: 1,
                                  ease: "power2.inOut",
                                })
                              }

                              // Update visual appearance
                              const cell =
                                numberCellsRef.current.get(selectedNumber)
                              if (cell) {
                                cell.isDisabled = true
                                cell.isSelected = true
                              }

                              // Update visual appearance of the selected number
                              const updateNumberVisual = (
                                mesh: THREE.Object3D
                              ) => {
                                if (!mesh) return
                                mesh.userData.isDisabled = true
                                mesh.traverse((child) => {
                                  if (child instanceof THREE.Mesh) {
                                    const material = child.material
                                    if (
                                      material instanceof
                                      THREE.MeshBasicMaterial
                                    ) {
                                      if (!material.map) {
                                        material.color.setHex(
                                          isDarkMode ? 0x333333 : 0xeeeeee
                                        )
                                        material.opacity = 0.3
                                        material.needsUpdate = true
                                      } else {
                                        material.opacity = 0.6
                                        const oldTexture = material.map
                                        const newTexture = createNumberTexture(
                                          selectedNumber,
                                          true
                                        )
                                        material.map = newTexture
                                        material.needsUpdate = true
                                        if (oldTexture) {
                                          oldTexture.dispose()
                                        }
                                      }
                                    }
                                  }
                                })
                              }

                              if (cell?.mesh) {
                                updateNumberVisual(cell.mesh)
                              }

                              if (sceneRef.current) {
                                sceneRef.current.traverse((obj) => {
                                  if (
                                    obj.userData.type === "numberCell" &&
                                    obj.userData.number === selectedNumber
                                  ) {
                                    updateNumberVisual(obj)
                                  }
                                })
                              }
                            } else {
                              setDialogStatus("error")
                            }
                          } else {
                            setUserHasSelected(true)
                            setDialogStatus("success")

                            // Update visual
                            const cell =
                              numberCellsRef.current.get(selectedNumber)
                            if (cell) {
                              cell.isDisabled = true
                              cell.isSelected = true
                            }
                          }
                        } catch (error) {
                          console.error("Error saving number:", error)
                          setDialogStatus("error")
                        } finally {
                          setIsSubmitting(false)
                        }
                      }}
                      disabled={isSubmitting}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDarkMode
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {isSubmitting ? "Saving..." : "Confirm"}
                    </button>
                  </div>
                </>
              )}

              {dialogStatus === "success" && (
                <>
                  <div className="mb-6">
                    <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center bg-green-500/20 animate-pulse">
                      <svg
                        className="w-16 h-16 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <h2
                    className={`text-3xl font-bold mb-4 ${
                      isDarkMode ? "text-green-300" : "text-green-700"
                    }`}
                  >
                    🎉 Congratulations! 🎉
                  </h2>
                  <p
                    className={`text-xl mb-2 font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Number {selectedNumber.toString()?.padStart(3, "0")} is
                    yours!
                  </p>
                  <p
                    className={`text-sm mb-6 ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    Your selection has been saved successfully.
                  </p>
                  <button
                    className={`px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                      isDarkMode
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                    onClick={() => setShowDialog(false)}
                  >
                    Awesome!
                  </button>
                </>
              )}

              {dialogStatus === "error" && (
                <>
                  <div className="mb-6">
                    <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center bg-red-500/20">
                      <svg
                        className="w-16 h-16 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                  </div>
                  <h2
                    className={`text-2xl font-bold mb-4 ${
                      isDarkMode ? "text-red-300" : "text-red-700"
                    }`}
                  >
                    Unable to Select
                  </h2>
                  <p
                    className={`text-lg mb-6 ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {userHasSelected
                      ? "You have already selected a number!"
                      : "This number has already been selected by someone else."}
                  </p>
                  <button
                    onClick={() => setShowDialog(false)}
                    className={`px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                      isDarkMode
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    OK
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Hero
