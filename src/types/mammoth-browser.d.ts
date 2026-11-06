// The browser build of mammoth has the same API as the main package.
declare module "mammoth/mammoth.browser" {
  import mammoth from "mammoth";
  export default mammoth;
}
