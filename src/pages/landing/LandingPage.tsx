import * as React from 'react'
import { Nav } from './Nav'
import { Hero } from './Hero'
import { Features } from './Features'
import { Modes } from './Modes'
import { Workflows } from './Workflows'
import { Tech } from './Tech'
import { Integrations } from './Integrations'
import { Security } from './Security'
import { FinalCta } from './FinalCta'
import { Footer } from './Footer'

export function LandingPage() {
  React.useEffect(() => {
    try {
      sessionStorage.setItem('clipforge_origin', 'home')
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="min-h-svh bg-background">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Modes />
        <Workflows />
        <Tech />
        <Integrations />
        <Security />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}