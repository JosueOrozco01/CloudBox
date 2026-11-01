import { useState } from 'react';
import { authenticatedFetch, normalizeApiUrl } from '../../services/dashboardService';
export default function AvatarEditor({onUpdated}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const upload=async event=>{
   const file=event.target.files?.[0];event.target.value='';if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){setError('Usa una imagen PNG, JPG o WebP de hasta 2 MB.');return;}
   setBusy(true);setError('');
   try{const body=new FormData();body.append('avatar',file);const response=await authenticatedFetch(`${normalizeApiUrl(import.meta.env.VITE_API_URL)}/users/me/avatar`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('token')}`},body});const result=await response.json();if(!response.ok)throw new Error(result.message||'No se pudo cambiar la foto.');onUpdated(result.data.avatarUrl);window.dispatchEvent(new Event('profile-changed'));}
   catch(error){setError(error.message);}finally{setBusy(false);}
 };
 return <div style={{margin:'16px 0'}}><label className="module-field">Foto de perfil<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload}/></label><p className="module-muted">{busy?'Guardando imagen…':'PNG, JPG o WebP · máximo 2 MB'}</p>{error&&<p role="alert">{error}</p>}</div>;
}
