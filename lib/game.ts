export class GameError extends Error {
  constructor(message:string, public status=400){super(message);}
}
export function cleanName(value:unknown){if(typeof value!=='string')throw new GameError('Enter a traveler name.');const name=value.trim().replace(/[<>\x00-\x1f]/g,'').slice(0,20);if(!name)throw new GameError('Enter a traveler name.');return name;}
export function cleanCode(value:unknown){if(typeof value!=='string'||!/^[A-HJ-NP-Z2-9]{6}$/.test(value.toUpperCase()))throw new GameError('Enter the six-character journey code.');return value.toUpperCase();}
export function getToken(request:Request){const token=request.headers.get('x-player-token');if(!token||token.length>100)throw new GameError('Join this journey to play.',403);return token;}
export function apiError(error:unknown){const status=error instanceof GameError?error.status:500;if(status===500)console.error('Room service error',error instanceof Error?error.message:'Unknown');return Response.json({error:error instanceof GameError?error.message:'The trail connection was interrupted. Your saved progress is safe. Try again.'},{status,headers:{'Cache-Control':'no-store'}});}
