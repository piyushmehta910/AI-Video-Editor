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