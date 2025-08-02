const logger = {
  info: (message) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`);
  },
  error: (message, error) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`);
    if (error) console.error(error);
  },
  db: (message) => {
    console.log(`[DB] [${new Date().toISOString()}] ${message}`);
  },
  debug: (message) => {
    console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`);
  },
  request: (req) => {
    console.log(
      `[REQUEST] [${new Date().toISOString()}] ${req.method} ${req.url}`,
    );
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      // Sanitize sensitive data
      if (sanitizedBody.password) sanitizedBody.password = "********";
      console.log("Request Body:", sanitizedBody);
    }
  },
};

module.exports = logger;
