import { verify } from 'jsonwebtoken'
import { Context } from './context'
import { APP_SECRET } from './constants'



interface Token {
  userId: string
}

export function getUserId(context: Context) {
  const authHeader = context.req.headers.authorization
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const verifiedToken = (()=>{
      try{
        return verify(token, APP_SECRET) as Token
      }
      catch{
        
      }
      })();
    return verifiedToken && Number(verifiedToken.userId)
  }
}
export function getUserIdSubscription(unverifiedToken: String) {
  if (unverifiedToken){
  const verifiedToken = verify(unverifiedToken, APP_SECRET) as Token
  return verifiedToken && Number(verifiedToken.userId)
  }
}
