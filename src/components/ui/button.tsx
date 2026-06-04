import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[9px] font-black uppercase tracking-[0.2em] ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_16px_-4px_rgba(153,69,255,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_8px_16px_-4px_rgba(255,0,0,0.3)]",
        outline:
          "border border-white/20 bg-white/[0.04] backdrop-blur-md hover:bg-white/[0.1] hover:border-white/30 hover:text-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-white/[0.05] hover:text-white text-muted-foreground/80",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "bg-white/[0.06] border border-white/20 backdrop-blur-xl text-white hover:bg-white/[0.12] hover:border-white/40 shadow-lg",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-8 rounded-full px-4",
        lg: "h-11 rounded-full px-8 text-[10px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
