import { verify } from 'jsonwebtoken'
import { Context } from './context'

export const APP_SECRET = '123'

interface Token {
  userId: string
}

export function getUserId(context: Context) {
  const authHeader = context.req.headers.authorization
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const verifiedToken = verify(token, APP_SECRET) as Token
    return verifiedToken && Number(verifiedToken.userId)
  }
}
