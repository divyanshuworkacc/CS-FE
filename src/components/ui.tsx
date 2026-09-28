import { useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, LoaderCircle, PackageOpen, X } from 'lucide-react'

export function ErrorNotice({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return <div className="error-notice" role="alert"><AlertCircle size={19} className="shrink-0" />
    <span className="flex-1">{children}</span>{retry && <button className="underline underline-offset-4" onClick={retry}>Retry</button>}
  </div>
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><PackageOpen size={30} strokeWidth={1.4} /></span>
    <h3>{title}</h3><p>{children}</p>{action}
  </div>
}
export function Loading() {
  return <div role="status" className="flex items-center justify-center gap-3 py-20 text-stone-500">
    <LoaderCircle size={20} className="animate-spin" /> Loading your store…
  </div>
}
export function Modal({ title, children, close, drawer = false }: {
  title: string; children: ReactNode; close: () => void; drawer?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow }
  }, [])
  return <dialog ref={ref} className={drawer ? 'modal drawer' : 'modal'} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === ref.current) close() }}>
    <div className="modal-inner"><div className="modal-heading"><h2 id="dialog-title">{title}</h2>
      <button className="icon-button" onClick={close} aria-label="Close dialog"><X size={21} /></button>
    </div>{children}</div>
  </dialog>
}
export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>
}
export function SignInPrompt({ action }: { action: () => void }) {
  return <EmptyState title="Make yourself at home" action={<button className="button-primary mt-5" onClick={action}>Sign in with Keycloak <ArrowRight size={17} /></button>}>
    Sign in to save your favourites, place an order, and keep track of your finds.
  </EmptyState>
}
