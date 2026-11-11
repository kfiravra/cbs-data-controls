// SVG files are bundled as text (angular.json, build loader) and registered with MatIconRegistry.
declare module '*.svg' {
  const content: string;
  export default content;
}
