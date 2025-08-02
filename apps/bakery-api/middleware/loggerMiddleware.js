const logger = require("../utils/logger");

const loggerMiddleware = (req, res, next) => {
  logger.request(req);
  next();
};

module.exports = loggerMiddleware;
