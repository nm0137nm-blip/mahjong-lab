#!/usr/bin/env python3
"""Build browser encoder from public Mortal/libriichi source (AGPL-3.0-or-later).
This step never processes user data or model weights.
"""
from pathlib import Path
import re,shutil,sys
upstream=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]).resolve()
src=out/'src'
if out.exists(): shutil.rmtree(out)
shutil.copytree(upstream/'libriichi'/'src',src)
def patch(f,fn):
    p=src/f; p.write_text(fn(p.read_text()))
def strip_pyo3(s):
    s=re.sub(r'^use pyo3::prelude::\*;\n','',s,flags=re.M)
    return re.sub(r'^#\[(?:pyclass|pymethods|getter|new|pyo3\([^\n]*?\))\]\n','',s,flags=re.M)
patch('state/player_state.rs',strip_pyo3)
patch('state/getter.rs',strip_pyo3)
patch('state/action.rs',strip_pyo3)
def obs(s):
    start=s.rfind('impl PlayerState {',0,s.index('fn encode_obs_py'))
    end=s.index('impl PlayerState {',s.index('fn encode_obs_py'))
    s=s[:start]+s[end:]
    s=strip_pyo3(s)
    return re.sub(r'^use numpy::\{PyArray1, PyArray2\};\n','',s,flags=re.M)
patch('state/obs_repr.rs',obs)
(src/'state/mod.rs').write_text("""mod action; mod agent_helper; mod getter; mod item; mod obs_repr; mod player_state; mod sp_tables; mod update;
pub use action::ActionCandidate;
pub use player_state::PlayerState;
pub use sp_tables::SinglePlayerTables;
""")
(src/'mjai/mod.rs').write_text("""mod event;
pub use event::{Event, EventExt, EventWithCanAct, Metadata, OutOfBoundError};
""")
def consts(s):
    s=re.sub(r'^use crate::py_helper::add_submodule;\n','',s,flags=re.M)
    s=strip_pyo3(s)
    return s[:s.index('pub(crate) fn register_module(')]
patch('consts.rs',consts)
(src/'lib.rs').write_text(r'''
#![allow(dead_code, unused_imports)]
mod array; mod consts; mod macros; mod vec_ops;
pub mod algo; pub mod chi_type; pub mod hand; pub mod mjai;
pub mod state; pub mod tile;
use state::PlayerState;
use mjai::Event;
use std::slice;
#[unsafe(no_mangle)]
pub extern "C" fn new_state(seat:u32)->u32 {
    if seat>3{return 0;}
    algo::shanten::ensure_init();
    algo::agari::ensure_init();
    Box::into_raw(Box::new(PlayerState::new(seat as u8))) as u32
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn drop_state(handle:u32){
    if handle!=0 { unsafe { drop(Box::from_raw(handle as *mut PlayerState)); } }
}
#[unsafe(no_mangle)]
pub extern "C" fn alloc_bytes(n:u32)->u32 {
    if n==0 || n>2_000_000{return 0;}
    let mut v=Vec::<u8>::with_capacity(n as usize);
    let ptr=v.as_mut_ptr(); std::mem::forget(v); ptr as u32
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn free_bytes(ptr:u32,n:u32){
    if ptr!=0 && n>0 && n<=2_000_000 {
      unsafe { drop(Vec::<u8>::from_raw_parts(ptr as *mut u8,0,n as usize)); }
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn apply_event(handle:u32, ptr:u32,n:u32)->i32{
    if handle==0||ptr==0||n==0||n>8192{return -1;}
    let bytes=unsafe{slice::from_raw_parts(ptr as *const u8,n as usize)};
    let Ok(ev)=serde_json::from_slice::<Event>(bytes) else{return -2;};
    let st=unsafe{&mut*(handle as *mut PlayerState)};
    match st.update(&ev){Ok(c)=>if c.can_act(){1}else{0},Err(_)=>-3}
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn encode_state(handle:u32, obs_dest:u32, mask_dest:u32)->i32{
    if handle==0||obs_dest==0||mask_dest==0{return -1;}
    let st=unsafe{&*(handle as *const PlayerState)};
    let (obs,mask)=st.encode_obs(4,false);
    let Some(flat)=obs.as_slice() else{return -2;};
    if flat.len()!=1012*34 || mask.len()!=46 {return -3;}
    unsafe{
      std::ptr::copy_nonoverlapping(flat.as_ptr(), obs_dest as *mut f32,flat.len());
      for (i,&v) in mask.iter().enumerate() {
        *((mask_dest as *mut u8).add(i)) = u8::from(v);
      }
    }
    0
}
''')
(out/'Cargo.toml').write_text("""
[package]
name="mahjong-lab-mortal-encoder"
version="0.1.0"
edition="2024"
license="AGPL-3.0-or-later"
[lib]
crate-type=["cdylib"]
[dependencies]
anyhow="1"
serde={version="1",features=["derive"]}
serde_json="1"
serde_with="3"
ndarray="0.16"
derivative="2"
tinyvec={version="1",features=["alloc","serde","rustc_1_57"]}
boomphf="0.6"
byteorder="1"
rayon="1"
rand="0.9"
rand_chacha="0.9"
flate2="1"
sha3="0.10"
glob="0.3"
ahash="0.8"
parking_lot="0.12"
crossbeam="0.8"
log="0.4"
getrandom={version="0.3",features=["wasm_js"]}
""".strip()+"\n")
print('Generated pure Rust encoder',out)
