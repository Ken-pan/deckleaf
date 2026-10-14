import {figmaImport,googleImport} from '../../../server/cloud-import';
import {preserveBrowserGoogleSource} from './google';
export async function browserCloudImport(path:string,body:any){
  try{
    if(path==='/api/import/figma')return await figmaImport(body.url,body.token);
    if(path==='/api/import/google'){const bundle=await googleImport(body.url,body.token);return {...bundle,...await preserveBrowserGoogleSource(bundle)};}
    throw new Error('Unsupported import.');
  }catch(error){if(error instanceof TypeError)throw new Error('The provider does not allow this browser request. Import an exported PowerPoint or Deck JSON file instead.');throw error;}
}
