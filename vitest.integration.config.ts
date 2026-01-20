import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],        
    sequence: { concurrent: false },
    //For integration tests, stop more than one worker "working" at once
    fileParallelism: false
  },

})
