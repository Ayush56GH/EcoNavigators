# EcoNavigators - Marine Environmental Intelligence

A modern, high-performance Next.js web application for marine oil spill detection, AIS vessel tracking correlation, and environmental intelligence.

---

## 🌊 Overview

EcoNavigators connects **Earth Observation (SAR Satellite Imagery)** with **Maritime AIS Telemetry** and hydrodynamic drift backtracking models to help investigators and regulatory authorities identify potential sources of marine oil spills.

### Key Capabilities
- **SAR Slick Detection:** Automated radar observation of sea surface anomalies regardless of cloud cover.
- **Hydrodynamic Drift Backtracking:** Reverse-simulation of wind and ocean currents to estimate spill origin points.
- **AIS Vessel Cross-Matching:** Temporal and spatial correlation with passing vessel traffic to build verifiable evidence trails.
- **Interactive 3D WebGL Investigation Stage:** Real-time Three.js scene demonstrating satellite sweeps, vessel tracks, and slick detection.

---

## 🛠 Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/)
- **3D & WebGL:** [Three.js](https://threejs.org/), [@react-three/fiber](https://r3f.docs.pmnd.rs/), [@react-three/drei](https://github.com/pmndrs/drei)
- **Animation & Icons:** [Lucide React](https://lucide.dev/), [GSAP](https://greensock.com/gsap/)
- **Styling:** Modular CSS Tokens & Layouts

---

## 📁 Project Architecture

```text
src/
├── app/                      # App Router root (layout, page, globals.css)
├── components/
│   ├── animation-canvas/     # 3D Three.js WebGL scene modules
│   ├── layout/               # Navbar, Footer, Chrome
│   ├── sections/             # Modular landing page sections
│   └── ui/                   # Reusable UI dialogs and primitives
├── data/                     # Typed static content and configuration
├── styles/                   # Modular stylesheets & design tokens
└── types/                    # TypeScript interfaces and domain models
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.

### 3. Build for Production
```bash
npm run build
npm run start
```

---

## 📄 License
Private project. © 2026 EcoNavigators.
