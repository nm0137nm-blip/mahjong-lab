#!/usr/bin/env python3
"""Real Mortal-S42 ONNX inference via installed ONNX Runtime 1.21 C API.

Synthetic zero observations ONLY: verifies runtime/weights, NOT mahjong strength.
Python standard library, no network, no GitHub calls, no payments.
Requires Linux libonnxruntime.so.1.21; intentionally refuses other ABI versions.
"""
import ctypes as c
import hashlib
import json
import sys
import time
from pathlib import Path

HASH = '30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'
LIB = '/usr/lib/x86_64-linux-gnu/libonnxruntime.so.1.21'
# Struct OrtApi indices from ONNX Runtime 1.21.0 (onnxruntime_c_api.h).
I = {'error':2,'env':3,'session':7,'run':9,'options':10,'tensor':49,
     'data':51,'memory':69,'free_env':92,'free_status':93,'free_memory':94,
     'free_session':95,'free_value':96,'free_options':100}


def main(path):
    model = Path(path)
    assert model.is_file(), 'Supply a locally stored model.onnx'
    actual = hashlib.sha256(model.read_bytes()).hexdigest()
    assert actual == HASH, 'Model hash mismatch. Refusing to load.'
    dll = c.CDLL(LIB)
    dll.OrtGetApiBase.restype = c.c_void_p
    base = c.cast(dll.OrtGetApiBase(), c.POINTER(c.c_void_p))
    get_api = c.CFUNCTYPE(c.c_void_p, c.c_uint)(base[0])
    version = c.CFUNCTYPE(c.c_char_p)(base[1])().decode()
    assert version.startswith('1.21.'), f'Unexpected ORT ABI: {version}'
    api = c.cast(get_api(21), c.POINTER(c.c_void_p))

    def f(idx, ret, *types):
        return c.CFUNCTYPE(ret, *types)(api[idx])

    def check(status):
        if status:
            msg = f(I['error'], c.c_char_p, c.c_void_p)(status)
            f(I['free_status'], None, c.c_void_p)(status)
            raise RuntimeError('ORT: ' + (msg or b'unknown').decode())

    env = c.c_void_p(); opt = c.c_void_p(); sess = c.c_void_p(); mem = c.c_void_p()
    release = f(I['free_value'], None, c.c_void_p)
    try:
        check(f(I['env'], c.c_void_p, c.c_int, c.c_char_p, c.POINTER(c.c_void_p))(3, b'mahjong-lab-cp223', c.byref(env)))
        check(f(I['options'], c.c_void_p, c.POINTER(c.c_void_p))(c.byref(opt)))
        started = time.perf_counter()
        check(f(I['session'], c.c_void_p, c.c_void_p, c.c_char_p, c.c_void_p, c.POINTER(c.c_void_p))(env, str(model).encode(), opt, c.byref(sess)))
        load_ms = 1000 * (time.perf_counter() - started)
        check(f(I['memory'], c.c_void_p, c.c_int, c.c_int, c.POINTER(c.c_void_p))(0, 0, c.byref(mem)))

        obs = (c.c_float * (1012 * 34))()
        obs_dims = (c.c_int64 * 3)(1, 1012, 34)
        mask = (c.c_ubyte * 46)(*([1] * 46))
        mask_dims = (c.c_int64 * 2)(1, 46)
        obs_val = c.c_void_p(); mask_val = c.c_void_p()
        make_tensor = f(I['tensor'], c.c_void_p, c.c_void_p, c.c_void_p,
                        c.c_size_t, c.POINTER(c.c_int64), c.c_size_t,
                        c.c_int, c.POINTER(c.c_void_p))
        check(make_tensor(mem, c.cast(obs, c.c_void_p), c.sizeof(obs), obs_dims, 3, 1, c.byref(obs_val)))
        check(make_tensor(mem, c.cast(mask, c.c_void_p), c.sizeof(mask), mask_dims, 2, 9, c.byref(mask_val)))
        try:
            names = (c.c_char_p * 2)(b'obs', b'mask')
            values = (c.c_void_p * 2)(obs_val, mask_val)
            output_names = (c.c_char_p * 1)(b'q')
            outputs = (c.c_void_p * 1)()
            run = f(I['run'], c.c_void_p, c.c_void_p, c.c_void_p,
                    c.POINTER(c.c_char_p), c.POINTER(c.c_void_p),
                    c.c_size_t, c.POINTER(c.c_char_p), c.c_size_t,
                    c.POINTER(c.c_void_p))
            qdata = f(I['data'], c.c_void_p, c.c_void_p, c.POINTER(c.c_void_p))
            def evaluate():
                started = time.perf_counter()
                check(run(sess, None, names, values, 2, output_names, 1, outputs))
                latency = 1000 * (time.perf_counter() - started)
                try:
                    result = c.c_void_p()
                    check(qdata(outputs[0], c.byref(result)))
                    q = list(c.cast(result, c.POINTER(c.c_float * 46)).contents)
                    return q, round(latency, 2)
                finally:
                    if outputs[0]: release(outputs[0]); outputs[0] = 0
            q, first_ms = evaluate()
            assert len(q) == 46 and all(-1e30 < v < 1e30 for v in q), 'Wrong output'
            mask[:] = (c.c_ubyte * 46)(*([0] * 46))
            mask[24] = 1
            restricted, second_ms = evaluate()
            assert max(range(46), key=lambda i: restricted[i]) == 24, 'Mask not enforced'
            assert all(restricted[i] == float('-inf') for i in range(46) if i != 24), 'Illegal action not masked'
            return {'status':'PASS_REAL_ONNX_INFERENCE','runtime':version,'model_sha256':actual,
                    'inputs':['obs','mask'],'output':'q[1,46]',
                    'load_ms':round(load_ms,2),'all_legal_ms':first_ms,
                    'only_action_24_ms':second_ms,'mask_enforced':True,
                    'warning':'Synthetic zero observation; no strategy or iPhone validation'}
        finally:
            release(obs_val); release(mask_val)
    finally:
        for name,obj in [('free_memory',mem),('free_session',sess),('free_options',opt),('free_env',env)]:
            if obj: f(I[name],None,c.c_void_p)(obj)


if __name__ == '__main__':
    print(json.dumps(main(sys.argv[1] if len(sys.argv)>1 else 'model.onnx'), indent=2))
