export {
  HIGHLIGHTED_KEYWORDS,
  WRONG_COLOR_CONFIG_MSG,
  makeLogger,
  parseTheme,
  setFileLogger,
  JSONFormatter,
  // Supporting types and classes
  getLogger,
  Logger,
  Handler,
  ConsoleHandler,
  FileHandler,
  Formatter,
  DefaultFormatter,
} from "./logger_utils.js";

export type {
  LoggerConfigSection,
  Theme,
  ParsedTheme,
  LogLevelName,
  LogRecord,
} from "./logger_utils.js";
