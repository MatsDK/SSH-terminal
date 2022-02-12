import React, { useContext, useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { TerminalContext } from "./TerminalProvider";
import { DraculaTheme, FirefoxDevTheme, UbuntuTheme } from "./theme";

interface SSHConnectProps {
	password: string
	username: string
	port?: number
	host: string
}

type DefaultStartTermProps = { size: { rows: number, cols: number }, id: string }

type StartTermLocalProps = ({ type: "local" } & DefaultStartTermProps)
type StartTermSSHProps = ({ type: "SSH" } & DefaultStartTermProps & SSHConnectProps)
type StartTermProps = StartTermLocalProps | StartTermSSHProps

interface TerminalOptions {
	fontSize?: number,
	fontFamily?: string
}
type useTerminalProps = TerminalOptions & ({ type: "local" } | ({ type: "SSH" } & SSHConnectProps))

export const useTerminal = (ref: React.RefObject<HTMLDivElement>, id: string, { type, ...props }: useTerminalProps) => {
	const { socket } = useContext(TerminalContext)
	const [terminal, setTerminal] = useState<Terminal | null>(null)

	useEffect(() => {
		const initTerminal = async () => {
			const { Terminal } = await import('xterm')
			const { FitAddon } = await import("xterm-addon-fit")

			const term = new Terminal({
				theme: FirefoxDevTheme,
				fontFamily: props.fontFamily || "Hack",
				fontSize: props.fontSize || 16

			})
			setTerminal(term)


			const fitAddon = new FitAddon();
			term.loadAddon(fitAddon);

			term.open(ref.current!)
			fitAddon.fit();

			const { cols, rows } = term
			const startTermProps: StartTermProps = type == "SSH" ? {
				type,
				id,
				host: (props as any).host,
				username: (props as any).username,
				password: (props as any).password,
				port: (props as any).port,
				size: { cols, rows }
			} : {
				type,
				id,
				size: { cols, rows }
			}


			socket!.emit("__start-term__", startTermProps)
			socket!.on("__data__", ({ data, id }) => {
				if (id === startTermProps.id) {
					// term.focus()
					term.write(data)
				}
			})

			socket!.on("__error__", err => {
				console.log(err)
			})

			socket!.on("__closed__", () => {
				console.log("connected closed")
			})

			term.onData((d) => {
				socket!.emit("__data__", { id, d })
			})

			window.addEventListener("resize", () => {
				fitAddon.fit()
				socket!.emit("__resize__", ({ id, rows: term.rows, cols: term.cols }))
			})
		}

		if (ref?.current && socket) {
			initTerminal()
		}

		return () => {
			terminal?.element?.remove()
			socket?.removeAllListeners()
		}
	}, [ref, socket])
}