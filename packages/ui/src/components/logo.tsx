import { ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-mark"
      src="https://i.ibb.co/HfQMWzmM/icon.png"
      alt="Logo"
      classList={{ [props.class ?? ""]: !!props.class }}
    />
  )
}

export const Splash = (props: Pick<ComponentProps<"img">, "ref" | "class">) => {
  return (
    <img
      ref={props.ref}
      data-component="logo-splash"
      src="https://i.ibb.co/HfQMWzmM/icon.png"
      alt="Logo Splash"
      classList={{ [props.class ?? ""]: !!props.class }}
    />
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <img
      src="https://i.ibb.co/HfQMWzmM/icon.png"
      alt="Logo Wordmark"
      classList={{ [props.class ?? ""]: !!props.class }}
    />
  )
}
