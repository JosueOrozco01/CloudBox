import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { authenticatedFetch, normalizeApiUrl } from '../../services/dashboardService';
export default function AvatarEditor({onUpdated}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const input=useRef(null);
 const upload=async event=>{
   const file=event.target.files?.[0];event.target.value='';if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){setError('Usa una imagen PNG, JPG o WebP de hasta 2 MB.');return;}
   setBusy(true);setError('');
   try{const body=new FormData();body.append('avatar',file);const response=await authenticatedFetch(`${normalizeApiUrl(import.meta.env.VITE_API_URL)}/users/me/avatar`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('token')}`},body});const result=await response.json();if(!response.ok)throw new Error(result.message||'No se pudo cambiar la foto.');onUpdated(result.data.avatarUrl);window.dispatchEvent(new Event('profile-changed'));}
   catch(error){setError(error.message);}finally{setBusy(false);}
 };
 return <section className="account-avatar-editor" aria-label="Foto de perfil"><div><strong>Foto de perfil</strong><p>{busy?'Guardando imagen…':'PNG, JPG o WebP · máximo 2 MB'}</p></div><input ref={input} aria-label="Seleccionar foto de perfil" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} hidden/><button type="button" className="module-button" disabled={busy} onClick={()=>input.current?.click()}><ImagePlus size={16}/>{busy?'Guardando…':'Cambiar foto'}</button>{error&&<p className="module-feedback error" role="alert">{error}</p>}</section>;
}
