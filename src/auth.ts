import { verify, decode } from 'jsonwebtoken'
import { Context } from './context'
import { APP_SECRET,CSRF_HEADER_NAME, GOOGLE_CLIENT_IDS, GOOGLE_STS_ENDPOINT} from './constants'
import { GraphQLError } from 'graphql';

interface Token {
  userId: string
}
interface GoogleToken{
  sub: string
}
interface publicKeyInterface{
  key:string,
}

interface firebasePublicKeyInterface extends publicKeyInterface{
  keyId:string;
}
class publicKey implements publicKeyInterface{
  private _key:string

  public async initialize(){
  }
  constructor(key:string){
    this._key = key;
  }
  public set key(key:string){
    this._key = key;
  }
  public get key(){
    return this._key;
  }

}

export class firebasePublicKey extends publicKey implements firebasePublicKeyInterface{
  private _keyId:string
  constructor(keyId:string){
    super('')
    this._keyId = keyId
  }
  public async initialize(){
    const firebaseKey =await  firebasePublicKey.getFirebaseAuthPEM(this._keyId);
    if(firebaseKey === undefined){
      throw new Error(`unable to get key`)
    }
    this.key = firebaseKey.key
  }
  public get keyId(){
    return this._keyId;
  }
  public async setFirebaseKey(keyId:string){
    if(this._keyId === keyId){
      return;
    }
    const key = await firebasePublicKey.getFirebaseAuthPEM(keyId)
    if(key===undefined){
      throw new Error(`unable to get key`)
    }
    this._keyId = key.keyId;
    this.key = key.key;
  }


  private static async getFirebaseAuthPEM(inputkeyId:string){
    //gets the key from the STS endpoint
    let STS_response  = await fetch(GOOGLE_STS_ENDPOINT)
    .then((res)=>{
      if (!res.ok) {
        throw new GraphQLError(`unable to get public key endpoint!`)
      }
      return res.json();
    })
    const validKey= Object.entries(STS_response).find(([keyId]) => keyId === inputkeyId);
  
    if(validKey && typeof validKey[1]==='string'){
      return {
        keyId:validKey[0],
        key: validKey[1]
      };
    }
    else{
      throw new Error(`key format is invalid!`)
    }
  
  }
}

let key :firebasePublicKey | undefined = undefined;

async function getFirebaseKey(keyId:string){
/**
 * Sets a new firebase PEM key on initialize.
 * If the KeyId is the same when presented with another token, reuses the key
 * If the key is different, gets a new key from the PEM endpoint
 */
  if(key === undefined){
    try{
      key = new firebasePublicKey(keyId);
      await key.initialize();

    }
    catch{
      throw new GraphQLError(`Invalid Key ID!`);
    }
  }
  else if(key.keyId!== keyId){
    try{
      await key.setFirebaseKey(keyId);
    }
    catch{
      throw new GraphQLError(`Invalid Key ID!`);
    }
  }
  return key.key;
}

export async function getGoogleUserId(Token:string){
  /**
   * Gets the sub of the token, and verifies if the token is valid
   */
  //get the header from the idToken
  const header = decode(Token,{
    complete:true
  }).header;

  if(header.typ!=='JWT' || header.alg!=='RS256'){
    throw new GraphQLError(`Invalid Token type!`)
  }
  const publicKey = await getFirebaseKey(header.kid);
  try{
    return verify(Token, publicKey) as GoogleToken
  }
  catch{}

}


export function getUserId(context: Context) {
  const authHeader = context.req.headers.authorization; 
  if(!context.req.headers[CSRF_HEADER_NAME]){
    return null;
  }
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
export async function getUserIdSubscription(unverifiedToken: String) {
  if (unverifiedToken){
  const verifiedToken = await verify(unverifiedToken, APP_SECRET) as Token
  return verifiedToken && Number(verifiedToken.userId)
  }
}
