'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Truck } from 'lucide-react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center p-8 bg-card rounded-2xl border border-border"
      >
        <Truck className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold mb-4">TSPPD-H Visualizador</h1>
        <p className="text-muted-foreground mb-6">Test page - React is working!</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCount(c => c + 1)}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
        >
          Click me: {count}
        </motion.button>
      </motion.div>
    </div>
  )
}