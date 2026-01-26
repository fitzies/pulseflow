import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return <div className="w-screen h-[90vh] flex items-center justify-center">
    <Spinner />
  </div>
}