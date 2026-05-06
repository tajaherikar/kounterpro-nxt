// Type declarations for CSS module side-effect imports
// (e.g. import './globals.css' in layout.tsx)
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
