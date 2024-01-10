const { createApp } = Vue

createApp({
  data() {
    return {
      jsonURL: 'data.json',
      jsonData: {},

      clusters: {},
      selectedCluster: null,
      selectedPartition: null,
      selectedWallTime: "00:07:00",
      jobName: "test",
      accountNumber: "1000001",
      outputFilename: "slurm-%j.out",
      partitionCommand: "",

      maxWalltime: "48:00:00",
      maxNodes: 32,
      minNodes: 1,
      maxTasks: 1024,
      maxMem: 93000,
      maxCores: 32,
      maxGPU: 2,
      allowShared: true,

      useNodes: false,
      useTasks: true,
      useTasksPerNode: false,
      useCpuPerTask: false,
      useMemory: false,
      useGPU: false,
      useModules: true,
      useCommand: true,


      selectedNodes: 1,
      selectedTasks: 1,
      selectedTasksPerNode: 1,
      selectedCpuPerTask: 1,
      selectedMemory: 1,
      selectedGPU:1,
      selectedShare: true,
      selectedRequeue: false,
      selectedExitError: false,
      selectedPurge: false,
      selectedCommand: "<Your command here>",
      selectedModules: "",

      memAboveRecommended: false,
    };
  },
  computed: {
    jobScript: function() {
      let job = "#!/bin/bash\n\n";
      job += "#SBATCH --job-name " + this.jobName + "   ## Name of the job\n";
      job += "#SBATCH --output " + this.outputFilename + "   ## Name of the output-script (%j will be replaced with job number)\n";
      job += "#SBATCH --account " + this.accountNumber + "   ## The billed account\n";
      job += "#SBATCH --time=" + this.selectedWallTime + "   ## Walltime of the job\n";

      if (this.partitionCommand) {
        job += "#SBATCH " + this.partitionCommand + "   ## Selected partition\n"
      }

      if (this.useMemory) {
        job += "#SBATCH --mem-per-cpu=" + this.selectedMemory + "   ## Memory allocated to each task\n";
      }
      if (this.useTasks) {
        job += "#SBATCH --ntasks=" + this.selectedTasks + "   ## Number of tasks that will be allocated\n";
      }
      if (this.useNodes) {
        job += "#SBATCH --nodes=" + this.selectedNodes + "   ## Number of nodes that will be allocated\n";
      }
      if (this.useTasksPerNode) {
        job += "#SBATCH --ntasks-per-node=" + this.selectedTasksPerNode + "   ## Number of tasks per node\n";
      }
      if (this.useCpuPerTask) {
        job += "#SBATCH --cpus-per-task=" + this.selectedCpuPerTask + "   ## Number of CPUs allocated for each task\n";
      }
      if (this.useGPU) {
        job += "#SBATCH --gpus=" + this.selectedGPU + "   ## CPUs allocated per task\n";
      }
      if (this.selectedRequeue) {
        job += "#SBATCH --requeue   ## Allows slurm to requeue a job in case of preemption or node failure\n"
      }
      if (!this.selectedShare) {
        job += "#SBATCH --exclusive   ## Does not allow others to use unused resources on the nodes allocated\n"
      }

      job += "\n";

      if (this.selectedExitError) {
        job += "set -o errexit   ## Exit the script on any error\n"
        job += "set -o nounset   ## Treat any unset variables as an error\n\n"
      }

      if (this.useModules) {
        if (this.selectedPurge) {
          job += "module --quiet purge\n";
        }
        if (this.selectedModules) {
          var moduleList = this.selectedModules.split(';')
          for (const moduleElement of moduleList) {
            job += "module load " + moduleElement + "\n"
          }
        }
        job += "\n"
      }
      if (this.useCommand) {
        job += this.selectedCommand + "   ## Command to be run\n";
      }
      return job;
    },
    jobScriptLength: function() {
      //let script = this.jobScript
      //let scriptLength = script.split('\n').length
      return this.jobScript.split('\n').length
    }
  },
  created() {

    this.jsonData = {clusters:[{name: "Other"}]}
    this.setClusterData()

    axios.get(this.jsonURL). then((response) => {
      this.jsonData = response.data
      this.setClusterData()
    })


  },
  methods: {
    setClusterData() {
      this.clusters = this.jsonData.clusters
      this.selectedCluster = this.clusters[0]

      if (this.selectedCluster.name != "Other") {
        this.selectedPartition = this.selectedCluster.partitions[0]
      }
      this.calculateLimits()
    },
    checkChecks() {
    },
    checkNodes() {
      if (this.maxNodes && this.selectedNodes > this.maxNodes) {
        this.selectedNodes = this.maxNodes;
      }
      if (this.selectedNodes < this.minNodes) {
        this.selectedNodes = this.minNodes
      }
    },
    checkTasks() {
      if (this.maxTasks && this.selectedTasks > this.maxTasks) {
        this.selectedNodes = this.maxTasks;
      }
    },
    checkTasksPerNode() {
      if (this.maxCores && this.selectedTasksPerNode > this.maxCores) {
        this.selectedTasksPerNode = this.maxCores;
      }
    },
    checkGPU() {
      if (this.selectedGPU > this.maxGPU) {
        this.selectedGPU = this.maxGPU;
      }
    },
    checkMemory() {
      if (this.maxMem && this.selectedMemory > this.maxMem) {
        this.selectedMemory = this.maxMem;
      }
      if (this.maxMem && this.maxCores) {
        this.memAboveRecommended = (this.selectedMemory > this.maxMem / this.maxCores)
      }
    },
    checkWallTime() {
      if (this.maxWalltime && this.selectedWallTime > this.maxWalltime) {
        this.selectedWallTime = this.maxWalltime;
      }
    },
    changeCluster() {
      if (this.selectedCluster.name != "Other") {
        this.selectedPartition = this.selectedCluster.partitions[0]
        this.calculateLimits()
      } else {
        this.selectedPartition = null;
      }
    },
    changePartition() {
      this.calculateLimits()
    },
    calculateLimits() {
      if (this.selectedCluster.name != "Other") {
        // Walltime
        if (this.selectedPartition.max_walltime) {
          this.maxWalltime = this.selectedPartition.max_walltime;
        }

        // Cores
        if (this.selectedPartition.cores_per_node) {
          this.maxCores = this.selectedPartition.cores_per_node;
        }

        // Nodes
        if (this.selectedPartition.max_nodes) {
          this.maxNodes = this.selectedPartition.max_nodes;
        } else if (this.selectedPartition.nodes) {
          this.maxNodes = this.selectedPartition.nodes;
        }

        // Min nodes
        if (this.selectedPartition.min_nodes) {
          this.minNodes = this.selectedPartition.min_nodes;
        }

        // Max tasks
        if (this.maxNodes && this.maxCores) {
          this.maxTasks = this.maxNodes * this.maxCores;
        }

        // Memory
        if (this.selectedPartition.memory_per_node) {
          this.maxMem = this.selectedPartition.memory_per_node;
        }

        // GPU
        if (this.selectedPartition.gpus_per_node) {
          this.maxGPU = this.selectedPartition.gpus_per_node
        } else {
          this.maxGPU = 0
        }

        // Shared
        if (this.selectedPartition.node_allocation == "shared") {
          this.allowShared = true;
        } else {
          this.allowShared = false;
        }

        // Partition
        if (this.selectedPartition.command) {
          this.partitionCommand = this.selectedPartition.command
        } else {
          this.partitionCommand = ""
        }
      }
    }
  }
}).mount('#app')
