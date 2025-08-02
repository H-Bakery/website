const fs = require('fs');
const path = require('path');

describe('Security Tests', () => {
  describe('JWT Secret Configuration', () => {
    it('should not contain hardcoded secrets in source code', async () => {
      // Files to check for hardcoded secrets
      const filesToCheck = [
        'middleware/authMiddleware.js',
        'controllers/authController.js',
        'services/socketService.js'
      ];

      const secretPatterns = [
        /SECRET_KEY\s*=\s*["'].*["']/,
        /your_secret_key/,
        /your-secret-key/,
        /\|\|\s*["'][^"']+["']\s*(?=\))/  // Fallback patterns like || 'default'
      ];

      for (const file of filesToCheck) {
        const filePath = path.join(__dirname, '../../', file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          for (const pattern of secretPatterns) {
            // Check if the pattern matches, but allow process.env references
            const matches = content.match(pattern);
            if (matches) {
              // Filter out matches that are part of process.env references
              const invalidMatches = matches.filter(match => 
                !match.includes('process.env') && 
                !match.includes('JWT_SECRET')
              );
              
              expect(invalidMatches).toHaveLength(0);
            }
          }
        }
      }
    });

    it('should require JWT_SECRET environment variable', () => {
      // Temporarily store the original JWT_SECRET
      const originalSecret = process.env.JWT_SECRET;
      
      // Test that JWT_SECRET is defined
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      
      // Test that it's not using the default/example secret
      expect(process.env.JWT_SECRET).not.toContain('your-very-secure-jwt-secret-key');
      expect(process.env.JWT_SECRET).not.toContain('CHANGE-THIS');
      
      // In test environment, we use a test secret
      // In production, it should be a random base64 string
      if (process.env.NODE_ENV !== 'test') {
        expect(process.env.JWT_SECRET).toMatch(/^[A-Za-z0-9+/]+=*$/);
      }
      
      // Restore original value
      process.env.JWT_SECRET = originalSecret;
    });

    it('should not export SECRET_KEY from authMiddleware', () => {
      const authMiddleware = require('../../middleware/authMiddleware');
      
      // Check that SECRET_KEY is not exported
      expect(authMiddleware.SECRET_KEY).toBeUndefined();
      
      // Check that only expected exports exist
      expect(Object.keys(authMiddleware)).toEqual([
        'authenticate',
        'requireAdmin',
        'requireStaff'
      ]);
    });

    it('should use environment variable for JWT operations', () => {
      const jwt = require('jsonwebtoken');
      const testPayload = { id: 123, role: 'user' };
      
      // Create a token using the environment variable
      const token = jwt.sign(testPayload, process.env.JWT_SECRET);
      
      // Verify it can be decoded with the same secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.role).toBe(testPayload.role);
    });
  });

  describe('Environment Configuration', () => {
    it('should have .env in .gitignore', () => {
      const gitignorePath = path.join(__dirname, '../../.gitignore');
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      
      expect(gitignoreContent).toContain('.env');
      expect(gitignoreContent).not.toContain('.env.example');
    });

    it('should have .env.example file with instructions', () => {
      const envExamplePath = path.join(__dirname, '../../.env.example');
      
      expect(fs.existsSync(envExamplePath)).toBe(true);
      
      const content = fs.readFileSync(envExamplePath, 'utf8');
      expect(content).toContain('JWT_SECRET');
      expect(content).toContain('your-very-secure-jwt-secret-key-change-this-in-production');
    });
  });
});