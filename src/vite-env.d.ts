/// <reference types="vite/client" />

declare module '*.wav' {
  const src: string;
  export default src;
}

declare module '*.wav?url' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}
