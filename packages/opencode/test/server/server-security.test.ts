import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"

const initialPassword = process.env.OPENCODE_SERVER_PASSWORD
const initialUsername = process.env.OPENCODE_SERVER_USERNAME
const initialAllowInsecure = process.env.OPENCODE_SERVER_ALLOW_INSECURE

afterEach(() => {
  if (initialPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD
  else process.env.OPENCODE_SERVER_PASSWORD = initialPassword

  if (initialUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME
  else process.env.OPENCODE_SERVER_USERNAME = initialUsername

  if (initialAllowInsecure === undefined) delete process.env.OPENCODE_SERVER_ALLOW_INSECURE
  else process.env.OPENCODE_SERVER_ALLOW_INSECURE = initialAllowInsecure
})

describe("server auth hardening", () => {
  test("allows loopback host without password", () => {
    delete process.env.OPENCODE_SERVER_PASSWORD
    delete process.env.OPENCODE_SERVER_ALLOW_INSECURE
    expect(() => Server.assertSecureServerConfig("127.0.0.1")).not.toThrow()
    expect(() => Server.assertSecureServerConfig("localhost")).not.toThrow()
  })

  test("rejects non-loopback host without password by default", () => {
    delete process.env.OPENCODE_SERVER_PASSWORD
    delete process.env.OPENCODE_SERVER_ALLOW_INSECURE
    expect(() => Server.assertSecureServerConfig("0.0.0.0")).toThrow("OPENCODE_SERVER_PASSWORD is required")
  })

  test("allows non-loopback host when password is configured", () => {
    process.env.OPENCODE_SERVER_PASSWORD = "secret"
    delete process.env.OPENCODE_SERVER_ALLOW_INSECURE
    expect(() => Server.assertSecureServerConfig("0.0.0.0")).not.toThrow()
  })

  test("allows non-loopback host with explicit insecure override", () => {
    delete process.env.OPENCODE_SERVER_PASSWORD
    process.env.OPENCODE_SERVER_ALLOW_INSECURE = "1"
    expect(() => Server.assertSecureServerConfig("0.0.0.0")).not.toThrow()
  })
})
