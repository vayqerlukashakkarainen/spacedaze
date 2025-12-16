# Agent Guidelines for SpaceDaze

## Project Overview
SpaceDaze is a 1-bit space shooter where the player controls a ship with their mouse. Players can upgrade their ship between levels using collected resources. Built with Kaplay game engine.

## Build/Dev Commands
- `npm run dev` - Start dev server on port 3001
- `npm run build` - Build production bundle with Vite
- `npm run preview` - Preview production build
- No test suite configured

## Code Style

### Language & Types
- TypeScript with type annotations for function parameters and complex objects
- Use interfaces for structured data (Ship, Session, Props, etc.)
- Use `undefined` for optional values (e.g., `blasterLvl: number | undefined`)
- No strict tsconfig - types are enforced by convention

### Imports & Structure
- Import from "kaplay" for game engine types and components
- Group imports: external libs first, then local modules
- Use named exports, avoid default exports

### Naming Conventions
- camelCase for variables, functions, and properties
- PascalCase for interfaces and enums
- SCREAMING_SNAKE_CASE for global constants (e.g., BULLET_SPEED)
- Prefix spawn functions with "spawn" (spawnAsteroid, spawnBoss1)
- Use descriptive names: `playerObj`, `debrees`, `projectiles`

### Formatting
- Tabs for indentation
- No semicolons (omit them consistently)
- Double quotes for strings
- Inline object definitions for kaplay components

### Error Handling
- Early returns for null checks: `if (!slot) return;`
- Use optional chaining sparingly - prefer explicit checks
- No try/catch blocks observed - let errors bubble up
