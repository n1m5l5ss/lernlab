// Component styles are CSS Modules (docs/TESTING.md, "A new button must not break other buttons"):
// `import styles from './X.module.css'` gives the component's scoped class names.
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
