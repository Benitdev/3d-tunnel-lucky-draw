import React, { useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';

interface HeroProps {
  isDarkMode: boolean;
}

const Hero: React.FC<HeroProps> = ({ isDarkMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Store refs for cleanup and animation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const segmentsRef = useRef<THREE.Group[]>([]);
  const scrollPosRef = useRef(0);

  // --- CONFIGURATION ---
  // Tuned to match the reference design's density and scale
  const TUNNEL_WIDTH = 24;
  const TUNNEL_HEIGHT = 16;
  const SEGMENT_DEPTH = 6; // Short depth for "square-ish" floor tiles
  const NUM_SEGMENTS = 14; 
  const FOG_DENSITY = 0.02;

  // Grid Divisions
  const FLOOR_COLS = 6; // Number of columns on floor/ceiling
  const WALL_ROWS = 4;  // Number of rows on walls

  // Derived dimensions
  const COL_WIDTH = TUNNEL_WIDTH / FLOOR_COLS;
  const ROW_HEIGHT = TUNNEL_HEIGHT / WALL_ROWS;

  // Unsplash images - Mix of portraits, landscapes, and abstracts
  const imageUrls = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&fit=crop", // People
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1488161628813-99c974c76949?q=80&w=600&fit=crop", // People
    "https://images.unsplash.com/photo-1521119989659-a83eee488058?q=80&w=600&fit=crop", // Abstract/Dark
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600&fit=crop", // Tech
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1664575602276-acd073f104c1?q=80&w=600&fit=crop", // Abstract
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&fit=crop", // Abstract
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&fit=crop", // Portrait
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=600&fit=crop", // Portrait
  ];

  // Helper: Create a segment with grid lines and filled cells
  const createSegment = (zPos: number) => {
    const group = new THREE.Group();
    group.position.z = zPos;

    const w = TUNNEL_WIDTH / 2;
    const h = TUNNEL_HEIGHT / 2;
    const d = SEGMENT_DEPTH;

    // --- 1. Grid Lines ---
    // Start with default light mode colors; these will be updated by useEffect immediately on mount
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xb0b0b0, transparent: true, opacity: 0.5 });
    const lineGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];

    // A. Longitudinal Lines (Z-axis)
    // Floor & Ceiling (varying X)
    for (let i = 0; i <= FLOOR_COLS; i++) {
      const x = -w + (i * COL_WIDTH);
      // Floor line
      vertices.push(x, -h, 0, x, -h, -d);
      // Ceiling line
      vertices.push(x, h, 0, x, h, -d);
    }
    // Walls (varying Y) - excluding top/bottom corners already drawn
    for (let i = 1; i < WALL_ROWS; i++) {
      const y = -h + (i * ROW_HEIGHT);
      // Left Wall line
      vertices.push(-w, y, 0, -w, y, -d);
      // Right Wall line
      vertices.push(w, y, 0, w, y, -d);
    }

    // B. Latitudinal Lines (Ring at z=0)
    // Floor (Bottom edge)
    vertices.push(-w, -h, 0, w, -h, 0);
    // Ceiling (Top edge)
    vertices.push(-w, h, 0, w, h, 0);
    // Left Wall (Left edge)
    vertices.push(-w, -h, 0, -w, h, 0);
    // Right Wall (Right edge)
    vertices.push(w, -h, 0, w, h, 0);

    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const lines = new THREE.LineSegments(lineGeo, lineMaterial);
    group.add(lines);

    // Initial population of images
    populateImages(group, w, h, d);

    return group;
  };

  // Helper: Populate images in a segment
  const populateImages = (group: THREE.Group, w: number, h: number, d: number) => {
    const textureLoader = new THREE.TextureLoader();
    const cellMargin = 0.4;

    const addImg = (pos: THREE.Vector3, rot: THREE.Euler, wd: number, ht: number) => {
        const url = imageUrls[Math.floor(Math.random() * imageUrls.length)];
        const geom = new THREE.PlaneGeometry(wd - cellMargin, ht - cellMargin);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
        textureLoader.load(url, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        mat.map = tex;
        mat.needsUpdate = true;
        gsap.to(mat, { opacity: 0.85, duration: 1 });
        });
        const m = new THREE.Mesh(geom, mat);
        m.position.copy(pos);
        m.rotation.copy(rot);
        m.name = "slab_image";
        group.add(m);
    };

    // Logic: Iterate slots, but skip if the previous slot was filled.
    // Threshold adjusted to 0.80 (20%) to compensate for skipped slots and maintain density.

    // Floor
    let lastFloorIdx = -999;
    for (let i = 0; i < FLOOR_COLS; i++) {
        // Must be at least 2 slots away from last image to avoid adjacency (i > last + 1)
        if (i > lastFloorIdx + 1) {
            if (Math.random() > 0.80) {
                addImg(new THREE.Vector3(-w + i*COL_WIDTH + COL_WIDTH/2, -h, -d/2), new THREE.Euler(-Math.PI/2,0,0), COL_WIDTH, d);
                lastFloorIdx = i;
            }
        }
    }
    
    // Ceiling
    let lastCeilIdx = -999;
    for (let i = 0; i < FLOOR_COLS; i++) {
        if (i > lastCeilIdx + 1) {
            if (Math.random() > 0.88) { // Keep ceiling sparser
                addImg(new THREE.Vector3(-w + i*COL_WIDTH + COL_WIDTH/2, h, -d/2), new THREE.Euler(Math.PI/2,0,0), COL_WIDTH, d);
                lastCeilIdx = i;
            }
        }
    }
    
    // Left Wall
    let lastLeftIdx = -999;
    for (let i = 0; i < WALL_ROWS; i++) {
        if (i > lastLeftIdx + 1) {
            if (Math.random() > 0.80) {
                addImg(new THREE.Vector3(-w, -h + i*ROW_HEIGHT + ROW_HEIGHT/2, -d/2), new THREE.Euler(0,Math.PI/2,0), d, ROW_HEIGHT);
                lastLeftIdx = i;
            }
        }
    }
    
    // Right Wall
    let lastRightIdx = -999;
    for (let i = 0; i < WALL_ROWS; i++) {
        if (i > lastRightIdx + 1) {
            if (Math.random() > 0.80) {
                addImg(new THREE.Vector3(w, -h + i*ROW_HEIGHT + ROW_HEIGHT/2, -d/2), new THREE.Euler(0,-Math.PI/2,0), d, ROW_HEIGHT);
                lastRightIdx = i;
            }
        }
    }
  }

  // --- INITIAL SETUP ---
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // THREE JS SETUP
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // Generate segments
    const segments: THREE.Group[] = [];
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const z = -i * SEGMENT_DEPTH;
      const segment = createSegment(z);
      scene.add(segment);
      segments.push(segment);
    }
    segmentsRef.current = segments;

    // Animation Loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!cameraRef.current || !sceneRef.current || !rendererRef.current) return;

      const targetZ = -scrollPosRef.current * 0.05; 
      const currentZ = cameraRef.current.position.z;
      cameraRef.current.position.z += (targetZ - currentZ) * 0.1;

      // Bidirectional Infinite Logic
      const tunnelLength = NUM_SEGMENTS * SEGMENT_DEPTH;
      
      const camZ = cameraRef.current.position.z;
      
      segmentsRef.current.forEach((segment) => {
        // 1. Moving Forward
        if (segment.position.z > camZ + SEGMENT_DEPTH) {
            let minZ = 0;
            segmentsRef.current.forEach(s => minZ = Math.min(minZ, s.position.z));
            segment.position.z = minZ - SEGMENT_DEPTH;
            
            // Re-populate
            const toRemove: THREE.Object3D[] = [];
            segment.traverse((c) => { if (c.name === 'slab_image') toRemove.push(c); });
            toRemove.forEach(c => {
                segment.remove(c);
                if (c instanceof THREE.Mesh) {
                    c.geometry.dispose(); 
                    if (c.material.map) c.material.map.dispose();
                    c.material.dispose();
                }
            });
            const w = TUNNEL_WIDTH / 2; const h = TUNNEL_HEIGHT / 2; const d = SEGMENT_DEPTH;
            populateImages(segment, w, h, d);
        }

        // 2. Moving Backward
        if (segment.position.z < camZ - tunnelLength - SEGMENT_DEPTH) {
            let maxZ = -999999;
            segmentsRef.current.forEach(s => maxZ = Math.max(maxZ, s.position.z));
            segment.position.z = maxZ + SEGMENT_DEPTH;

            // Re-populate
            const toRemove: THREE.Object3D[] = [];
            segment.traverse((c) => { if (c.name === 'slab_image') toRemove.push(c); });
            toRemove.forEach(c => {
                segment.remove(c);
                if (c instanceof THREE.Mesh) {
                    c.geometry.dispose(); 
                    if (c.material.map) c.material.map.dispose();
                    c.material.dispose();
                }
            });
            const w = TUNNEL_WIDTH / 2; const h = TUNNEL_HEIGHT / 2; const d = SEGMENT_DEPTH;
            populateImages(segment, w, h, d);
        }
      });

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    const onScroll = () => { scrollPosRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll);
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []); // Run once on mount

  // --- THEME UPDATE EFFECT ---
  useEffect(() => {
    if (!sceneRef.current) return;

    // Define theme colors
    const bgHex = isDarkMode ? 0x050505 : 0xffffff;
    const fogHex = isDarkMode ? 0x050505 : 0xffffff; 
    
    // Light mode: Light Grey lines (0xb0b0b0), higher opacity
    // Dark mode: Medium Grey lines (0x555555) for visibility, slightly adjusted opacity
    const lineHex = isDarkMode ? 0x555555 : 0xb0b0b0;
    const lineOp = isDarkMode ? 0.35 : 0.5;

    // Apply to scene
    sceneRef.current.background = new THREE.Color(bgHex);
    if (sceneRef.current.fog) {
        (sceneRef.current.fog as THREE.FogExp2).color.setHex(fogHex);
    }

    // Apply to existing grid lines
    segmentsRef.current.forEach(segment => {
        segment.children.forEach(child => {
            if (child instanceof THREE.LineSegments) {
                const mat = child.material as THREE.LineBasicMaterial;
                mat.color.setHex(lineHex);
                mat.opacity = lineOp;
                mat.needsUpdate = true;
            }
        });
    });
  }, [isDarkMode]);

  // Text Entrance Animation
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "power3.out", delay: 0.5 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full h-[10000vh] transition-colors duration-700 ${isDarkMode ? 'bg-[#050505]' : 'bg-white'}`}>
      <div className="fixed inset-0 w-full h-full overflow-hidden z-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div ref={contentRef} className="text-center flex flex-col items-center max-w-3xl px-6 pointer-events-auto mix-blend-multiply-normal"> 
          
          <h1 className={`text-[5rem] md:text-[7rem] lg:text-[8rem] leading-[0.85] font-bold tracking-tighter mb-8 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-dark'}`}>
            Clone yourself.
          </h1>
          
          <p className={`text-lg md:text-xl font-normal max-w-lg leading-relaxed mb-10 transition-colors duration-500 ${isDarkMode ? 'text-gray-400' : 'text-muted'}`}>
            Build the digital version of you to scale your expertise and availability, <span className="text-accent font-medium">infinitely</span>
          </p>

          <div className="flex items-center gap-6">
            <button className={`rounded-full px-8 py-3.5 text-sm font-medium hover:scale-105 transition-all duration-300 ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-dark text-white'}`}>
              Try now
            </button>
            <button className={`text-sm font-medium hover:opacity-70 transition-opacity flex items-center gap-1 ${isDarkMode ? 'text-white' : 'text-dark'}`}>
              See examples <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;