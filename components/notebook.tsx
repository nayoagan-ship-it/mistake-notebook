"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {BookOpen,Plus,X,ImagePlus,Camera,Pencil,Trash2,LoaderCircle,Check} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {type Mistake,type Photo,photoUrl} from "@/lib/notebook-types";
type DraftImage={id:string;src:string;file?:File;photo?:Photo};
type Draft={id?:string;title:string;category:string;images:DraftImage[]};
async function api<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{...options,cache:"no-store"});
 const data=await response.json().catch(()=>null) as (T & {error?:string})|null;
 if(!response.ok)throw new Error(data?.error||"连接暂时不可用，请稍后重试。");
 if(!data)throw new Error("请刷新页面后重新登录。");
 return data as T;
}
async function prepareImage(file:File):Promise<File>{
 if(!file.type.startsWith("image/")||file.size>20*1024*1024)throw new Error("请选择 20 MB 以内的图片。");
 const src=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=src;
  await img.decode().catch(()=>{throw new Error("图片无法读取，请选择 JPG、PNG 或 WebP 图片。");});
  const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement("canvas");canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("图片处理失败，请重试。");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("图片处理失败。")),"image/jpeg",.88));
  if(blob.size>3*1024*1024)throw new Error("图片仍然太大，请裁剪或换一张再试。");
  return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
 }finally{URL.revokeObjectURL(src);}
}
export default function Notebook(){
 const [items,setItems]=useState<Mistake[]>([]);
 const [categories,setCategories]=useState<string[]>([]);
 const [activeCategory,setActiveCategory]=useState("");
 const [categoryDialog,setCategoryDialog]=useState(false);
 const [newCategory,setNewCategory]=useState("");
 const [categoryError,setCategoryError]=useState("");
 const [categorySaving,setCategorySaving]=useState(false);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState("");
 const [draft,setDraft]=useState<Draft|null>(null);
 const [selected,setSelected]=useState<Mistake|null>(null);
 const [deleteTarget,setDeleteTarget]=useState<Mistake|null>(null);
 const [busy,setBusy]=useState(false);
 const [processing,setProcessing]=useState(false);
 const [formError,setFormError]=useState("");
 const [message,setMessage]=useState("");
 const gallery=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null);
 const objectUrls=useRef<string[]>([]),readVersion=useRef(0),uploadLock=useRef(false);
 const load=useCallback(async()=>{
  const version=++readVersion.current;setLoading(true);setLoadError("");
  try{
   const [data,catalog]=await Promise.all([api<{mistakes:Mistake[]}>("/api/mistakes"),api<{categories:string[]}>("/api/categories")]);
   if(version===readVersion.current){setItems(data.mistakes);setCategories(catalog.categories);}
  }
  catch(error){if(version===readVersion.current)setLoadError(error instanceof Error?error.message:"加载失败，请重试。");}
  finally{if(version===readVersion.current)setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
  return ()=>objectUrls.current.forEach(url=>URL.revokeObjectURL(url));
 },[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(""),2500);return()=>clearTimeout(timer);},[message]);
 const releaseUrls=()=>{objectUrls.current.forEach(url=>URL.revokeObjectURL(url));objectUrls.current=[];};
 const allCategories=[...new Set([...categories,...items.map(item=>item.category).filter(Boolean)])];
 const visible=activeCategory?items.filter(item=>item.category===activeCategory):items;
 const newDraft=()=>{releaseUrls();setFormError("");setDraft({title:"",category:activeCategory,images:[]});};
 const edit=(item:Mistake)=>{releaseUrls();setSelected(null);setFormError("");setDraft({id:item.id,title:item.title,category:item.category,images:item.images.map(photo=>({id:photo.key,src:photoUrl(photo.key),photo}))});};
 const discard=()=>{
  if(busy||processing)return;
  const original=items.find(item=>item.id===draft?.id);
  const changed=!!draft&&(original?draft.title!==original.title||draft.category!==original.category||draft.images.map(image=>image.id).join()!==original.images.map(photo=>photo.key).join():!!draft.title.trim()||draft.images.length>0);
  if(changed&&!window.confirm("放弃未保存的修改？"))return;
  draft?.images.filter(image=>image.file&&image.photo).forEach(image=>void fetch(photoUrl(image.photo!.key),{method:"DELETE"}));
  releaseUrls();setDraft(null);setFormError("");
 };
 const addImages=async(files:FileList|File[]|null)=>{
  if(!files||!draft||uploadLock.current||busy)return;
  const list=Array.from(files);if(draft.images.length+list.length>6){setFormError("每条记录最多添加 6 张图片。");return;}
  uploadLock.current=true;setProcessing(true);setFormError("");const added:DraftImage[]=[];
  try{
   for(const file of list){const prepared=await prepareImage(file);const src=URL.createObjectURL(prepared);objectUrls.current.push(src);added.push({id:crypto.randomUUID(),src,file:prepared});}
   setDraft(current=>current?{...current,images:[...current.images,...added]}:current);
  }catch(error){added.forEach(image=>URL.revokeObjectURL(image.src));setFormError(error instanceof Error?error.message:"图片读取失败。");}
  finally{uploadLock.current=false;setProcessing(false);if(gallery.current)gallery.current.value="";if(camera.current)camera.current.value="";}
 };
 const removeImage=(image:DraftImage)=>{
  if(image.file&&image.photo)void fetch(photoUrl(image.photo.key),{method:"DELETE"});
  setDraft(current=>current?{...current,images:current.images.filter(item=>item.id!==image.id)}:current);
 };
 const save=async(event:React.FormEvent)=>{
  event.preventDefault();if(!draft||busy||processing)return;
  if(!draft.title.trim()){setFormError("请填写标题。");return;}
  if(!draft.images.length){setFormError("请添加至少一张图片。");return;}
  setBusy(true);setFormError("");
  try{
   const photos:Photo[]=[];
   for(const image of draft.images){
    if(image.photo)photos.push(image.photo);
    else{
     const body=new FormData();body.append("file",image.file!);
     const {photo}=await api<{photo:Photo}>("/api/photos",{method:"POST",body});photos.push(photo);
     setDraft(current=>current?{...current,images:current.images.map(item=>item.id===image.id?{...item,photo}:item)}:current);
    }
   }
   const {mistake}=await api<{mistake:Mistake}>(draft.id?"/api/mistakes/"+draft.id:"/api/mistakes",{method:draft.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:draft.title.trim(),category:draft.category,images:photos})});
   ++readVersion.current;setItems(current=>draft.id?current.map(item=>item.id===draft.id?mistake:item):[mistake,...current]);
   if(mistake.category)setCategories(current=>current.includes(mistake.category)?current:[...current,mistake.category]);
   if(activeCategory&&mistake.category!==activeCategory)setActiveCategory("");
   setLoading(false);setLoadError("");setDraft(null);releaseUrls();setMessage("已保存");
  }catch(error){setFormError(error instanceof Error?error.message:"保存失败，请重试。");}
  finally{setBusy(false);}
 };
 const deleteItem=async()=>{
  if(!deleteTarget||busy)return;setBusy(true);setFormError("");
  try{await api("/api/mistakes/"+deleteTarget.id,{method:"DELETE"});++readVersion.current;setItems(current=>current.filter(item=>item.id!==deleteTarget.id));setSelected(null);setDeleteTarget(null);setMessage("已删除");}
  catch(error){setFormError(error instanceof Error?error.message:"删除失败，请重试。");}
  finally{setBusy(false);}
 };
 const openCategoryDialog=()=>{setNewCategory("");setCategoryError("");setCategoryDialog(true);};
 const saveCategory=async(event:React.FormEvent)=>{
  event.preventDefault();if(categorySaving)return;
  if(!newCategory.trim()){setCategoryError("请填写分类名称。");return;}
  setCategorySaving(true);setCategoryError("");
  try{
   const data=await api<{name:string;categories:string[]}>("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:newCategory.trim()})});
   ++readVersion.current;setCategories(data.categories);
   if(draft)setDraft(current=>current?{...current,category:data.name}:current);else setActiveCategory(data.name);
   setCategoryDialog(false);setMessage("分类已添加");
  }catch(error){setCategoryError(error instanceof Error?error.message:"添加失败，请重试。");}
  finally{setCategorySaving(false);}
 };
 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/"><BookOpen size={24}/><h1>错题本</h1></a><Button className="primary" onClick={newDraft}><Plus size={18}/>添加图片</Button></header>
  <main className="workspace">
   <div className="category-toolbar"><label className="sr-only" htmlFor="category-filter">查看分类</label><select id="category-filter" className="text-input" value={activeCategory} onChange={event=>setActiveCategory(event.target.value)} disabled={loading}><option value="">全部</option>{allCategories.map(name=><option key={name} value={name}>{name}</option>)}</select><Button className="secondary" variant="outline" disabled={loading||!!loadError} onClick={openCategoryDialog}><Plus size={16}/>新增分类</Button></div>
   {loadError?<div className="state-panel" role="alert"><p>{loadError}</p><Button className="primary" onClick={()=>void load()}>重新加载</Button></div>:
    loading?<div className="state-panel loading-state"><LoaderCircle size={28} className="spin"/><span>正在加载…</span></div>:
    !visible.length?<div className="state-panel empty-state"><ImagePlus size={42} strokeWidth={1.5}/><p>{activeCategory?"这个分类还没有图片":"还没有图片"}</p><Button className="primary" onClick={newDraft}><Plus size={18}/>添加图片</Button></div>:
    <div className="cards">{visible.map(item=><article className="mistake-card" key={item.id}><button className="card-preview" aria-label={"查看图片："+item.title} onClick={()=>setSelected(item)}><img src={photoUrl(item.images[0].key)} alt={item.title} loading="lazy"/></button><div className="card-bottom"><button className="card-title" onClick={()=>setSelected(item)}>{item.title}</button><div className="card-actions"><button aria-label={"编辑："+item.title} title="编辑" onClick={()=>edit(item)}><Pencil size={17}/></button><button aria-label={"删除："+item.title} title="删除" onClick={()=>{setFormError("");setDeleteTarget(item);}}><Trash2 size={17}/></button></div></div></article>)}</div>}
  </main>
  {message&&!draft&&!selected&&!deleteTarget&&!categoryDialog&&<div className="toast" role="status"><Check size={17}/>{message}</div>}
  <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!categoryDialog)discard();}}>
   <DialogContent className="editor-dialog" showCloseButton={false} onEscapeKeyDown={event=>{event.preventDefault();if(!categoryDialog)discard();}} onPointerDownOutside={event=>event.preventDefault()}>
    <div className="dialog-heading"><DialogTitle>{draft?.id?"编辑":"添加图片"}</DialogTitle><DialogDescription className="sr-only">选择图片并填写标题</DialogDescription><button className="close-btn" aria-label="关闭编辑" disabled={busy||processing} onClick={discard}><X size={21}/></button></div>
    <form className="editor-form" onSubmit={event=>void save(event)}>
     <div className="editor-scroll">
      <label className="field-label">图片</label>
      <div className="upload-area" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void addImages(event.dataTransfer.files);}}>
       {draft?.images.length?<div className="upload-previews">{draft.images.map((image,index)=><div className="upload-photo" key={image.id}><img src={image.src} alt={"图片 "+(index+1)}/><button type="button" aria-label={"移除图片 "+(index+1)} disabled={busy||processing} onClick={()=>removeImage(image)}><X size={17}/></button></div>)}</div>:<ImagePlus className="upload-icon" size={40} strokeWidth={1.5}/>}
       <div className="upload-buttons"><Button type="button" variant="outline" className="secondary" disabled={busy||processing||(draft?.images.length||0)>=6} onClick={()=>gallery.current?.click()}>{processing?<LoaderCircle size={17} className="spin"/>:<ImagePlus size={17}/>}选择图片</Button><Button type="button" variant="outline" className="secondary" disabled={busy||processing||(draft?.images.length||0)>=6} onClick={()=>camera.current?.click()}><Camera size={17}/>拍照</Button></div>
       <input ref={gallery} type="file" accept="image/*" multiple className="hidden-input" onChange={event=>void addImages(event.target.files)}/>
       <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden-input" onChange={event=>void addImages(event.target.files)}/>
      </div>
      <label className="field-label title-label" htmlFor="title">标题</label>
      <input id="title" className="text-input" autoComplete="off" maxLength={80} placeholder="填写标题" value={draft?.title||""} disabled={busy} onChange={event=>setDraft(current=>current?{...current,title:event.target.value}:current)}/>
      <label className="field-label title-label" htmlFor="record-category">分类（可选）</label>
      <div className="record-category-row"><select id="record-category" className="text-input" value={draft?.category||""} disabled={busy} onChange={event=>setDraft(current=>current?{...current,category:event.target.value}:current)}><option value="">不分类</option>{allCategories.map(name=><option key={name} value={name}>{name}</option>)}</select><Button type="button" className="secondary" variant="outline" onClick={openCategoryDialog} disabled={busy||processing||loading||!!loadError}><Plus size={16}/>新增分类</Button></div>
      {formError&&<p className="form-error" role="alert">{formError}</p>}
     </div>
     <div className="dialog-footer"><Button type="button" variant="outline" className="secondary" onClick={discard} disabled={busy||processing}>取消</Button><Button type="submit" className="primary" disabled={busy||processing}>{busy?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>} {busy?"正在保存…":"保存"}</Button></div>
    </form>
   </DialogContent>
  </Dialog>
  <Dialog open={categoryDialog} onOpenChange={open=>{if(!categorySaving)setCategoryDialog(open);}}>
   <DialogContent className="small-dialog category-dialog" showCloseButton={false} onPointerDownOutside={event=>event.preventDefault()} onEscapeKeyDown={event=>{if(categorySaving)event.preventDefault();}}>
    <div className="category-dialog-heading"><DialogTitle>新增分类</DialogTitle><button className="close-btn" aria-label="关闭新增分类" disabled={categorySaving} onClick={()=>setCategoryDialog(false)}><X size={21}/></button></div><DialogDescription className="sr-only">填写分类名称</DialogDescription>
    <form onSubmit={event=>void saveCategory(event)}><label className="field-label" htmlFor="new-category-name">分类名称</label><input id="new-category-name" className="text-input" autoComplete="off" maxLength={24} placeholder="例如：数学、阅读理解" value={newCategory} disabled={categorySaving} onChange={event=>setNewCategory(event.target.value)}/>{categoryError&&<p className="form-error" role="alert">{categoryError}</p>}<div className="confirm-actions"><Button type="button" className="secondary" variant="outline" disabled={categorySaving} onClick={()=>setCategoryDialog(false)}>取消</Button><Button type="submit" className="primary" disabled={categorySaving}>{categorySaving?<LoaderCircle size={17} className="spin"/>:<Plus size={17}/>}添加分类</Button></div></form>
   </DialogContent>
  </Dialog>
  <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}>
   <DialogContent className="detail-dialog" showCloseButton={false}>
    <div className="dialog-heading"><DialogTitle>{selected?.title}</DialogTitle><DialogDescription className="sr-only">查看图片</DialogDescription><button className="close-btn" aria-label="关闭图片" onClick={()=>setSelected(null)}><X size={21}/></button></div>
    <div className="detail-images">{selected?.images.map((photo,index)=><a href={photoUrl(photo.key)} target="_blank" rel="noreferrer" key={photo.key} aria-label={"放大图片 "+(index+1)}><img src={photoUrl(photo.key)} alt={selected.title+"，图片 "+(index+1)}/></a>)}</div>
    <div className="dialog-footer"><Button className="primary" onClick={()=>selected&&edit(selected)}><Pencil size={17}/>编辑</Button></div>
   </DialogContent>
  </Dialog>
  <Dialog open={!!deleteTarget} onOpenChange={open=>{if(!open&&!busy)setDeleteTarget(null);}}>
   <DialogContent className="small-dialog" showCloseButton={!busy}>
    <DialogTitle>删除这条记录？</DialogTitle><DialogDescription>“{deleteTarget?.title}”及其图片将被删除。</DialogDescription>
    {formError&&<p className="form-error" role="alert">{formError}</p>}
    <div className="confirm-actions"><Button className="secondary" variant="outline" onClick={()=>setDeleteTarget(null)} disabled={busy}>取消</Button><Button className="danger" onClick={()=>void deleteItem()} disabled={busy}>{busy?"正在删除…":"删除"}</Button></div>
   </DialogContent>
  </Dialog>
 </div>;
}

