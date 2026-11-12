import Image from "next/image";

// Nurse Mira, the app's cartoon nurse (Erika's own character, D-066). Images live in /public/mira.
const POSES = {
  hello: [132, 383],
  laughing: [145, 382],
  worried: [131, 383],
  thinking: [155, 371],
  surprised: [182, 372],
  sleepy: [124, 367],
  pleading: [112, 372],
  "thumbs-up": [145, 356],
  confident: [148, 350],
  celebrate: [196, 353],
  kiss: [104, 356],
} as const;
export type MiraPose = keyof typeof POSES;

/** A full-body pose, `height` pixels tall. Decorative unless `alt` is given. */
export function Mira({ pose, height, className = "", alt = "", priority = false }: { pose: MiraPose; height: number; className?: string; alt?: string; priority?: boolean }) {
  const [w, h] = POSES[pose];
  return (
    <Image
      src={`/mira/${pose}.webp`}
      width={Math.round((w * height) / h)}
      height={height}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      priority={priority}
      unoptimized
      className={`pointer-events-none select-none ${className}`}
    />
  );
}

/** Round face picture, used next to Nurse Mira's answers. */
export function MiraFace({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <Image src="/mira/face.webp" width={size} height={size} alt="" aria-hidden unoptimized className={`shrink-0 rounded-full ring-2 ring-white shadow-sm ${className}`} />;
}
