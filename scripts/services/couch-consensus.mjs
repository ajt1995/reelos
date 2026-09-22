export class CouchConsensus {
  
  dot(v1, v2) {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) sum += v1[i] * v2[i];
    return sum;
  }
  
  mag(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    return Math.sqrt(sum);
  }
  
  cosineSim(v1, v2) {
    if (!v1 || !v2 || v1.length === 0 || v2.length === 0) return 0;
    const m1 = this.mag(v1);
    const m2 = this.mag(v2);
    if (m1 === 0 || m2 === 0) return 0;
    return this.dot(v1, v2) / (m1 * m2);
  }

  findConsensus(candidateTitles, profiles) {
    // candidateTitles: [{ id: string, vector: Float32Array, ... }]
    // profiles: [{ id: string, vector: Float32Array, dislikedIds: Set<string> | string[] }]
    
    if (!candidateTitles || candidateTitles.length === 0) return [];
    if (!profiles || profiles.length === 0) return candidateTitles;

    const scoredTitles = candidateTitles.map(candidate => {
      let minSatisfaction = Infinity;
      let anyoneDisliked = false;

      for (const profile of profiles) {
        const dislikedIds = profile.dislikedIds || [];
        const disliked = Array.isArray(dislikedIds) 
          ? dislikedIds.includes(candidate.id)
          : (dislikedIds instanceof Set ? dislikedIds.has(candidate.id) : false);
        
        if (disliked) {
          anyoneDisliked = true;
        }

        const sim = (profile.vector && candidate.vector) ? this.cosineSim(profile.vector, candidate.vector) : 0;
        if (sim < minSatisfaction) {
          minSatisfaction = sim;
        }
      }

      if (anyoneDisliked) {
        minSatisfaction -= 1000; 
      }

      return {
        ...candidate,
        score: minSatisfaction,
        disputeFree: !anyoneDisliked
      };
    });

    scoredTitles.sort((a, b) => b.score - a.score);
    return scoredTitles;
  }
  
  blendProfiles(profiles = []) {
    if (!profiles || profiles.length === 0) {
      return { vector: null, profileCount: 0, disputeFree: true, dislikedIds: new Set() };
    }
    const validProfiles = profiles.filter(p => p && p.vector && p.vector.length > 0);
    if (validProfiles.length === 0) {
      return { vector: null, profileCount: 0, disputeFree: true, dislikedIds: new Set() };
    }
    const dims = validProfiles[0].vector.length;
    const blended = new Float32Array(dims);
    const allDisliked = new Set();

    for (const p of validProfiles) {
      for (let i = 0; i < dims; i++) {
        blended[i] += p.vector[i] || 0;
      }
      if (p.dislikedIds) {
        if (Array.isArray(p.dislikedIds)) {
          p.dislikedIds.forEach(id => allDisliked.add(id));
        } else if (p.dislikedIds instanceof Set) {
          p.dislikedIds.forEach(id => allDisliked.add(id));
        }
      }
    }
    for (let i = 0; i < dims; i++) {
      blended[i] /= validProfiles.length;
    }
    return {
      vector: blended,
      profileCount: validProfiles.length,
      disputeFree: allDisliked.size === 0,
      dislikedIds: allDisliked
    };
  }
}

export const couchConsensus = new CouchConsensus();
