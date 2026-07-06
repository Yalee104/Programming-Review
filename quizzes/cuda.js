// CUDA quiz — questions map to sections of cuda_study_summary.md
// level: "beginner" | "intermediate" | "advanced"
window.QUIZZES = window.QUIZZES || {};
window.QUIZZES.cuda = {
  title: "CUDA Quiz",
  sections: {
    1: "The Mental Model — Host vs Device",
    2: "First Kernel — __global__ and <<< >>>",
    3: "Compiling & Running",
    4: "Thread Hierarchy — Who Am I?",
    5: "The Standard Workflow — Vector Add",
    6: "Grid-Stride Loop",
    7: "Error Checking",
    8: "Function Qualifiers",
    9: "Memory Spaces Overview",
    10: "Shared Memory & __syncthreads()",
    11: "Parallel Reduction",
    12: "Unified Memory — cudaMallocManaged",
    13: "2D Grids — dim3 and Matrix Add"
  },
  questions: [
    // ---- Section 1
    {
      type: "mc",
      level: "beginner",
      q: "In CUDA terminology, what are the **host** and the **device**?",
      choices: [
        "Host = the CPU + system RAM (orchestrates); Device = the GPU + its own memory (runs kernels)",
        "Host = the GPU, Device = the CPU",
        "Host = the main thread, Device = worker threads",
        "They are two GPUs in SLI"
      ],
      answer: 0,
      explain: "The host runs normal C++ and orchestrates everything; the device runs kernels — functions launched across thousands of lightweight threads. The key mindset shift: instead of a loop over elements, you write the loop BODY once and launch one thread per element.",
      section: 1
    },
    {
      type: "mc",
      level: "beginner",
      q: "What is the standard 5-step pattern of almost every CUDA program?",
      choices: [
        "Allocate GPU memory → copy host→device → launch kernel → copy device→host → free",
        "Launch kernel → allocate → copy → sync → free",
        "Copy → free → launch → allocate → copy",
        "Allocate → launch → allocate → launch → free"
      ],
      answer: 0,
      explain: "1) cudaMalloc, 2) cudaMemcpy HostToDevice, 3) kernel<<<blocks, threads>>>, 4) cudaMemcpy DeviceToHost, 5) cudaFree. The host↔device copies over PCIe are the slowest link — minimize them.",
      section: 1
    },
    // ---- Section 2
    {
      type: "mc",
      level: "beginner",
      q: "What does the `__global__` qualifier mean on a function?",
      choices: [
        "It's a kernel: called from HOST code, runs on the DEVICE, must return void",
        "It's a global variable accessor",
        "It runs on both CPU and GPU",
        "It's visible to all translation units"
      ],
      answer: 0,
      explain: "`__global__` marks a kernel — the entry point the host launches with `<<<blocks, threadsPerBlock>>>`. Kernels return void and cannot be called like normal functions; the launch syntax is mandatory.",
      section: 2
    },
    {
      type: "mc",
      level: "beginner",
      q: "How many threads does `hello<<<2, 3>>>();` launch in total?",
      choices: [
        "6 — 2 blocks × 3 threads per block",
        "5 — 2 + 3",
        "8 — 2³",
        "1 — the parameters are just hints"
      ],
      answer: 0,
      explain: "`<<<blocks, threadsPerBlock>>>` launches blocks × threadsPerBlock threads — here 6, each printing its own line. Order BETWEEN blocks is not guaranteed; the GPU schedules blocks whenever it likes.",
      section: 2
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Why can `main` exit before a kernel's `printf` output ever appears, without `cudaDeviceSynchronize()`?",
      choices: [
        "Kernel launches are ASYNCHRONOUS — the host continues immediately and may finish first",
        "printf is not allowed in kernels",
        "The GPU only runs kernels after main returns",
        "Output is buffered for exactly 10 seconds"
      ],
      answer: 0,
      explain: "A kernel launch returns control to the host immediately. Without a synchronization point (cudaDeviceSynchronize, or an implicit one like cudaMemcpy), main can exit while the GPU is still working — one of the first things every CUDA beginner hits.",
      section: 2
    },
    // ---- Section 3
    {
      type: "fill",
      level: "beginner",
      q: "What is NVIDIA's compiler driver called — the command you use instead of g++ to build .cu files?",
      accept: ["nvcc"],
      answerDisplay: "`nvcc`",
      explain: "`nvcc hello.cu -o hello` — nvcc wraps the host compiler (g++/cl) for CPU code and compiles the device code itself. Useful flags: -O2, -arch=native (build for YOUR GPU), -arch=sm_86 (target explicitly).",
      section: 3
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What happens if you put CUDA code in a `.cpp` file instead of `.cu`?",
      choices: [
        "nvcc treats it as plain C++ — kernel syntax like `<<< >>>` fails to compile",
        "Nothing; the extension doesn't matter",
        "It compiles but runs on the CPU",
        "nvcc auto-renames it"
      ],
      answer: 0,
      explain: "The file extension matters: only .cu files go through CUDA compilation. Also useful: `nvidia-smi` shows your GPU/driver, `nvcc --version` the toolkit version.",
      section: 3
    },
    // ---- Section 4
    {
      type: "mc",
      level: "beginner",
      q: "What is the single most important line in CUDA — computing a thread's unique global index?",
      choices: [
        "`int idx = blockIdx.x * blockDim.x + threadIdx.x;`",
        "`int idx = threadIdx.x * blockIdx.x;`",
        "`int idx = gridDim.x + blockDim.x;`",
        "`int idx = threadIdx.x + blockDim.x;`"
      ],
      answer: 0,
      explain: "Each thread knows its block (blockIdx.x), the block width (blockDim.x), and its position within the block (threadIdx.x). block × width + position = a unique global index across the whole grid.",
      section: 4
    },
    {
      type: "mc",
      level: "intermediate",
      q: "With `showIndex<<<3, 4>>>()`, what is the global index of **block 2, thread 1**?",
      choices: [
        "9 — 2 × 4 + 1",
        "7 — 2 + 4 + 1",
        "21 — 2 × 10 + 1",
        "3 — block index + thread index"
      ],
      answer: 0,
      explain: "idx = blockIdx.x * blockDim.x + threadIdx.x = 2 × 4 + 1 = 9 (verified in the summary's output table). 3 blocks × 4 threads = 12 threads with global indices 0–11.",
      section: 4
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Why does CUDA organize threads into BLOCKS at all?",
      choices: [
        "A block's threads run on the same SM, can share fast memory, and can synchronize; blocks are the unit the GPU scales with",
        "Blocks are purely cosmetic grouping",
        "Only one block can run at a time",
        "Blocks avoid the 1024-thread global limit"
      ],
      answer: 0,
      explain: "Threads within a block share an SM (streaming multiprocessor), can cooperate through __shared__ memory, and can __syncthreads(). More SMs → more blocks run concurrently. Limits: max 1024 threads per block; typical choices are 128–512.",
      section: 4
    },
    // ---- Section 5
    {
      type: "mc",
      level: "beginner",
      q: "For N = 8 elements and 4 threads per block, how many blocks does `(N + threads - 1) / threads` give?",
      choices: [
        "2",
        "3",
        "1",
        "4"
      ],
      answer: 0,
      explain: "(8 + 3) / 4 = 2 (integer division). Two blocks of four threads cover all 8 elements exactly — the vector-add example's configuration, verified output c[i] = 11i.",
      section: 5
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Why is the launch computed as `(N + threads - 1) / threads` instead of `N / threads`?",
      choices: [
        "It's ceiling division — when N isn't a multiple of the block size, plain division would UNDERCOUNT and leave elements unprocessed",
        "It makes the kernel faster",
        "It avoids launching more than 1024 blocks",
        "Both are equivalent"
      ],
      answer: 0,
      explain: "Integer division truncates: N=10, threads=4 → 10/4 = 2 blocks = 8 threads, leaving 2 elements untouched. Ceiling division gives 3 blocks (12 threads) so every element gets a thread — paired with the `if (i < n)` guard for the extras.",
      section: 5
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What is the `if (i < n)` guard for in almost every kernel?",
      code: "__global__ void vecAdd(const float* a, const float* b, float* c, int n) {\n    int i = blockIdx.x * blockDim.x + threadIdx.x;\n    if (i < n)\n        c[i] = a[i] + b[i];\n}",
      choices: [
        "The last block usually has leftover threads whose index exceeds n — without the guard they write out of bounds",
        "It skips negative indices",
        "It's an optimization hint for the scheduler",
        "It prevents two threads from writing the same element"
      ],
      answer: 0,
      explain: "Ceiling division rounds the grid UP, so the final block can have threads with i >= n. The guard makes them do nothing instead of corrupting memory past the array end. Memorize the pair: ceiling division + bounds guard.",
      section: 5
    },
    // ---- Section 6
    {
      type: "mc",
      level: "intermediate",
      q: "In a grid-stride loop, what is the stride?",
      code: "int stride = ______;\nfor (int i = blockIdx.x * blockDim.x + threadIdx.x; i < n; i += stride)\n    x[i] *= f;",
      choices: [
        "`blockDim.x * gridDim.x` — the TOTAL number of threads in the grid",
        "`blockDim.x` — threads per block",
        "`gridDim.x` — number of blocks",
        "`1` — threads walk sequentially"
      ],
      answer: 0,
      explain: "Each thread starts at its global index and hops by the total thread count, so any N is covered no matter how few threads you launched. This is the recommended default kernel shape — correctness independent of launch configuration.",
      section: 6
    },
    {
      type: "mc",
      level: "advanced",
      q: "N=10 but only `<<<2, 4>>>` = 8 threads are launched with a grid-stride loop. Which elements does thread 0 process?",
      choices: [
        "x[0] and x[8] — its global index, then index + 8 (the total thread count)",
        "x[0] and x[1] — consecutive elements",
        "x[0] only — the rest are skipped",
        "x[0], x[2], x[4]… — every other element"
      ],
      answer: 0,
      explain: "Stride = blockDim.x × gridDim.x = 8. Thread 0 handles i=0, then i=8; thread 1 handles i=1, then i=9 (verified in the summary's output). Threads 2–7 each handle one element — everything covered with fewer threads than elements.",
      section: 6
    },
    // ---- Section 7
    {
      type: "mc",
      level: "intermediate",
      q: "A kernel launch returns nothing. How do you find out it failed?",
      choices: [
        "`cudaGetLastError()` right after the launch (bad config), plus `cudaDeviceSynchronize()`'s return value (errors during execution)",
        "The kernel throws a C++ exception",
        "Check errno",
        "You can't — kernel errors are undetectable"
      ],
      answer: 0,
      explain: "CUDA calls fail silently unless checked. API calls return cudaError_t; launches need cudaGetLastError() for configuration errors and cudaDeviceSynchronize() for runtime errors. Everyone wraps this in a CUDA_CHECK macro printing cudaGetErrorString(err).",
      section: 7
    },
    {
      type: "mc",
      level: "advanced",
      q: "What does `vecAdd<<<1, 2000>>>(...)` produce?",
      choices: [
        "`invalid configuration argument` — 2000 exceeds the 1024 threads-per-block limit",
        "It works; blocks are auto-split",
        "A compile error",
        "Undefined behavior with no error"
      ],
      answer: 0,
      explain: "Max threads per block is 1024, so the launch fails with 'invalid configuration argument' — caught by CUDA_CHECK(cudaGetLastError()) after the launch (verified in the summary). Typical block sizes are 128–512.",
      section: 7
    },
    // ---- Section 8
    {
      type: "mc",
      level: "beginner",
      q: "Who can call a `__device__` function?",
      choices: [
        "Only device code — kernels and other __device__ functions",
        "Only the host",
        "Anyone, anywhere",
        "Only main()"
      ],
      answer: 0,
      explain: "`__device__` = helper that runs on the GPU, callable from kernels/other device functions. Calling it from host code is a compile error — the qualifiers tell nvcc where each function must be compiled to run. (`__global__` = host-callable kernel; `__host__` = plain CPU function.)",
      section: 8
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does marking a function `__host__ __device__` do?",
      choices: [
        "Compiles it TWICE — usable from CPU code AND inside kernels",
        "Makes it run on both simultaneously",
        "It's a syntax error — pick one",
        "It runs on the host but reads device memory"
      ],
      answer: 0,
      explain: "The double qualifier generates both a CPU and a GPU version of the function — handy for small utilities (math helpers) shared by host and device code paths.",
      section: 8
    },
    // ---- Section 9
    {
      type: "mc",
      level: "beginner",
      q: "Where does data allocated with `cudaMalloc` live?",
      choices: [
        "Global memory — the GPU's main RAM, visible to all threads",
        "Shared memory",
        "Registers",
        "Host RAM"
      ],
      answer: 0,
      explain: "cudaMalloc + cudaMemcpy put data in global memory: large, visible to every thread, but relatively slow. The memory hierarchy from fastest to largest: registers → shared (per-block) → global; plus constant memory for small read-only data.",
      section: 9
    },
    {
      type: "mc",
      level: "intermediate",
      q: "When should a block stage data into `__shared__` memory?",
      choices: [
        "When the block's threads REUSE the same data multiple times — shared is on-chip and much faster than global",
        "Always — shared memory is bigger than global",
        "Only for read-only data",
        "Never; it's deprecated"
      ],
      answer: 0,
      explain: "Shared memory (~48KB+, per-block, on-chip) pays off when data is read repeatedly — like the neighbor-sum example where each element is read 3 times. Load once from global into the shared tile, sync, then compute from fast memory.",
      section: 9
    },
    {
      type: "mc",
      level: "intermediate",
      q: "When is `__constant__` memory at its best?",
      choices: [
        "When ALL threads read the SAME element — it's cached and broadcast",
        "When every thread writes to it",
        "For very large arrays",
        "When threads read random unrelated elements"
      ],
      answer: 0,
      explain: "Constant memory is read-only from kernels, set from the host with cudaMemcpyToSymbol, and optimized for broadcast: when all threads in a warp read the same address, it's served from cache at register-like speed. Perfect for small shared parameters/coefficients.",
      section: 9
    },
    // ---- Section 10
    {
      type: "mc",
      level: "intermediate",
      q: "Why is `__syncthreads()` needed between filling a shared-memory tile and reading it?",
      code: "tile[i] = in[i];        // phase 1: every thread loads one element\n__syncthreads();        // <- why?\nout[i] = tile[i-1] + tile[i] + tile[i+1];   // phase 2: read neighbors",
      choices: [
        "Threads run in parallel — without the barrier, a thread could read a neighbor's slot BEFORE that neighbor wrote it",
        "It flushes shared memory to global memory",
        "It's only needed for debugging",
        "It makes the code run faster"
      ],
      answer: 0,
      explain: "__syncthreads() is a barrier: every thread in the block must arrive before any proceeds. It separates the 'everyone writes' phase from the 'everyone reads' phase — skip it and you read garbage from slots not yet written.",
      section: 10
    },
    {
      type: "mc",
      level: "advanced",
      q: "What happens if `__syncthreads()` is called inside a divergent branch, e.g. `if (threadIdx.x < k) { __syncthreads(); }`?",
      choices: [
        "Deadlock / undefined behavior — EVERY thread in the block must reach the same barrier",
        "Only the branching threads sync; the rest continue",
        "The compiler removes it",
        "It becomes a grid-wide sync"
      ],
      answer: 0,
      explain: "The barrier waits for ALL of the block's threads; threads that skipped the branch never arrive, so the ones inside wait forever. That's why the reduction example keeps __syncthreads() OUTSIDE the `if (t < stride)` — every thread reaches it each iteration.",
      section: 10
    },
    {
      type: "mc",
      level: "advanced",
      q: "How far does `__syncthreads()` reach?",
      choices: [
        "Only threads within ONE block — there is no cheap grid-wide sync inside a kernel",
        "Every thread in the entire grid",
        "All blocks on the same SM",
        "The host thread too"
      ],
      answer: 0,
      explain: "Synchronization is per-block only. To synchronize the whole grid, you generally end the kernel and launch another (or use cooperative groups on supporting hardware) — which is why reductions produce per-block partials combined afterwards.",
      section: 10
    },
    // ---- Section 11
    {
      type: "mc",
      level: "advanced",
      q: "A tree reduction sums 128 values per block in how many steps?",
      code: "for (int stride = blockDim.x / 2; stride > 0; stride >>= 1) {\n    if (t < stride) s[t] += s[t + stride];\n    __syncthreads();\n}",
      choices: [
        "7 — the active threads halve each step: log2(128)",
        "128 — one per element",
        "64 — half the elements",
        "1 — all additions happen at once"
      ],
      answer: 0,
      explain: "64 threads add pairs, then 32, 16, 8, 4, 2, 1 — log2(128) = 7 iterations instead of 127 sequential additions. Verified in the summary: two blocks over N=256 produce partials 8128 and 24512, total 32640 = 255·256/2.",
      section: 11
    },
    {
      type: "mc",
      level: "intermediate",
      q: "After each block computes its partial sum, how is the final total typically produced?",
      choices: [
        "A tiny final combine on the host (or a second small kernel) over the per-block partials",
        "Block 0 magically sees the other blocks' results",
        "__syncthreads() merges them",
        "The driver adds them automatically"
      ],
      answer: 0,
      explain: "Grid produces per-block partial results → small final combine on the host. Reductions, histograms, max/min all follow this shape, because blocks can't synchronize with each other inside one kernel launch.",
      section: 11
    },
    // ---- Section 12
    {
      type: "mc",
      level: "beginner",
      q: "What does `cudaMallocManaged` give you?",
      choices: [
        "ONE pointer usable from both CPU and GPU — the driver migrates pages automatically, no cudaMemcpy needed",
        "Faster GPU-only memory",
        "Memory that never needs freeing",
        "A pointer valid only inside kernels"
      ],
      answer: 0,
      explain: "Unified memory removes the copy boilerplate: the CPU writes the arrays directly, the kernel reads/writes the same pointers. Great for learning and prototyping; explicit cudaMemcpy still wins for peak performance.",
      section: 12
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What is the #1 unified-memory bug?",
      code: "vecAdd<<<2, 4>>>(a, b, c, N);\nfor (int i = 0; i < N; i++) printf(\"%g\\n\", c[i]);   // bug?",
      choices: [
        "Reading results before the async kernel finished — there's no cudaMemcpy to wait on, so you must call cudaDeviceSynchronize() first",
        "Forgetting to free the memory",
        "Using printf on managed memory",
        "Launching too few blocks"
      ],
      answer: 0,
      explain: "With explicit copies, cudaMemcpy implicitly waits for the kernel. With managed memory nothing waits for you — the CPU can read c[] while the GPU is still computing. Always cudaDeviceSynchronize() before the host touches results.",
      section: 12
    },
    // ---- Section 13
    {
      type: "mc",
      level: "intermediate",
      q: "In a 2D kernel, how do (row, col) map to the flat array index for a row-major matrix?",
      code: "int col = blockIdx.x * blockDim.x + threadIdx.x;\nint row = blockIdx.y * blockDim.y + threadIdx.y;\nint i = ______;",
      choices: [
        "`row * cols + col`",
        "`col * rows + row`",
        "`row + col`",
        "`row * col`"
      ],
      answer: 0,
      explain: "Row-major storage lays rows end to end, so element (row, col) sits at row × cols + col. x conventionally maps to columns and y to rows; the same 1D idioms apply per axis.",
      section: 13
    },
    {
      type: "mc",
      level: "intermediate",
      q: "A 16×16 block grid is launched for a 2×3 matrix. Why must the kernel check `row < rows && col < cols`?",
      choices: [
        "The block has 256 threads but only 6 elements exist — 250 threads must do nothing or they'd write out of bounds",
        "dim3 requires it syntactically",
        "Row and col could be negative",
        "It's only needed for square matrices"
      ],
      answer: 0,
      explain: "Same guard idiom as 1D, applied per axis: ceiling division rounds the grid up (`dim3 grid((cols+15)/16, (rows+15)/16)`), so most threads in a tiny matrix fall outside the bounds and must be masked off. Verified example: C = A + 100 for the 2×3 case.",
      section: 13
    }
  ]
};
