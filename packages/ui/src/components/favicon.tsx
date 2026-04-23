import { Link, Meta } from "@solidjs/meta"

export const Favicon = () => {
  return (
    <>
      <Link rel="icon" type="image/png" href="https://i.ibb.co/HfQMWzmM/icon.png" />
      <Link rel="shortcut icon" href="https://i.ibb.co/HfQMWzmM/icon.png" />
      <Link rel="apple-touch-icon" href="https://i.ibb.co/HfQMWzmM/icon.png" />
      <Link rel="manifest" href="/site.webmanifest" />
      <Meta name="apple-mobile-web-app-title" content="Carthis" />
    </>
  )
}
