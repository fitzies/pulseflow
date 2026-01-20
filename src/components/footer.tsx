import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from 'lucide-react'

import { Separator } from '@/components/ui/separator'


const Footer = () => {
  return (
    <footer>
      <Separator />

      <div className='mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 max-md:flex-col sm:px-6 sm:py-6 md:gap-6 md:py-8'>
        <a href='#'>
          <div className='flex items-center gap-3 font-semibold'>
            Pulseflow 2026
          </div>
        </a>

        <div className='flex items-center gap-5 whitespace-nowrap'>
          {/* <a href='#' className='opacity-80 transition-opacity duration-300 hover:opacity-100'>
            About
          </a>
          <a href='#' className='opacity-80 transition-opacity duration-300 hover:opacity-100'>
            Features
          </a>
          <a href='#' className='opacity-80 transition-opacity duration-300 hover:opacity-100'>
            Works
          </a>
          <a href='#' className='opacity-80 transition-opacity duration-300 hover:opacity-100'>
            Career
          </a> */}
          The Pulsechain Automation
        </div>

      </div>


    </footer>
  )
}

export default Footer
