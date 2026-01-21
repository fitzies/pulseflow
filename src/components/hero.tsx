"use client"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AUTH_URLS } from "@/lib/constants"

type ProductTeaserCardProps = {
  dailyVolume?: string
  dailyVolumeLabel?: string
  headline?: string
  subheadline?: string
  description?: string
  videoSrc?: string
  posterSrc?: string
  primaryButtonText?: string
  primaryButtonHref?: string
  secondaryButtonText?: string
  secondaryButtonHref?: string
}

// @component: ProductTeaserCard
export const Hero = (props: ProductTeaserCardProps) => {
  const {
    dailyVolumeLabel = "AUTOMATIONS EXECUTED DAILY",
    headline = "Visual Automation for On-Chain Execution",
    subheadline = "Design, deploy, and run deterministic blockchain workflows using a visual node editor. Automate swaps, transfers, conditions, and monitoring on PulseChain — powered by isolated wallets and secure execution.",
    videoSrc = "",
    posterSrc = "/images/hero/flow-editor-preview.png",
    primaryButtonText = "Create your first flow",
    primaryButtonHref = AUTH_URLS.signUp,
    secondaryButtonText = "View node library",
    secondaryButtonHref = AUTH_URLS.signUp,
  } = props


  // @return
  return (
    <section className="w-full px-8 pt-32 pb-16">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-2">
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              duration: 0.8,
              ease: [0.645, 0.045, 0.355, 1],
            }}
            className="col-span-12 lg:col-span-6"
          >
            <Card className="border-none shadow-none rounded-[40px] h-full">
              <CardContent className="p-12 lg:p-16 flex flex-col justify-end aspect-square overflow-hidden">
                <a
                  href={primaryButtonHref}
                  className="flex flex-col gap-1 text-muted-foreground"
                >
                  <motion.span
                    initial={{
                      transform: "translateY(20px)",
                      opacity: 0,
                    }}
                    animate={{
                      transform: "translateY(0px)",
                      opacity: 1,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: [0.645, 0.045, 0.355, 1],
                      delay: 0.6,
                    }}
                    className="text-sm uppercase tracking-tight font-mono flex items-center gap-1"
                  >
                    {dailyVolumeLabel}
                    <ArrowUpRight className="w-[0.71em] h-[0.71em]" />
                  </motion.span>
                </a>

                <h1 className="text-[56px] leading-[60px] tracking-tight text-foreground max-w-[520px] mb-6 font-medium font-sans">
                  {headline}
                </h1>

                <p className="text-lg leading-7 text-muted-foreground max-w-[520px] mb-6 font-sans">
                  {subheadline}
                </p>


                <div className="flex gap-2 flex-wrap mt-10">
                  <Button
                    asChild
                    className="px-[18px] py-[15px] h-auto text-base leading-4 transition-all duration-150"
                  >
                    <a href={primaryButtonHref}>
                      {primaryButtonText}
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="px-[18px] py-[15px] h-auto text-base leading-4 text-foreground border-foreground bg-transparent hover:bg-transparent "
                  >
                    <a href={secondaryButtonHref}>
                      {secondaryButtonText}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              duration: 0.8,
              ease: [0.645, 0.045, 0.355, 1],
              delay: 0.2,
            }}
            className="col-span-12 lg:col-span-6"
          >
            <Card
              className="border-none shadow-none rounded-[40px] h-full aspect-square overflow-hidden"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1575519627029-6fb7d4bbaf46?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <CardContent className="p-0 flex justify-center items-center h-full">
                <video
                  src={videoSrc}
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={posterSrc}
                  className="hidden w-full h-full object-cover"
                  style={{
                    backgroundImage:
                      "url(https://images.unsplash.com/photo-1575519627029-6fb7d4bbaf46?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
