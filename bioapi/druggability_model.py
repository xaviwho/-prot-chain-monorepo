"""
ML-enhanced druggability prediction using GradientBoosting.

Trained on synthetic data derived from published druggability criteria:
- Halgren (2009): Identifying and characterizing binding sites and assessing druggability
- Schmidtke & Barril (2010): Understanding and predicting druggability

Features used:
  1. volume: Cavity volume in cubic angstroms
  2. hydrophobic_ratio: Fraction of hydrophobic residues lining the pocket
  3. polar_ratio: Fraction of polar residues
  4. charged_ratio: Fraction of charged residues
  5. nearby_residue_count: Number of residues lining the pocket
  6. surface_accessibility: Estimated solvent-accessible surface area fraction
  7. cavity_points: Number of grid points defining the cavity
  8. depth_score: Estimated pocket depth (deeper = more druggable)
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-load sklearn to avoid import errors if not installed
_sklearn_available = None
_GradientBoostingRegressor = None


def _ensure_sklearn():
    global _sklearn_available, _GradientBoostingRegressor
    if _sklearn_available is not None:
        return _sklearn_available
    try:
        from sklearn.ensemble import GradientBoostingRegressor as GBR
        _GradientBoostingRegressor = GBR
        _sklearn_available = True
    except ImportError:
        logger.warning("scikit-learn not installed; ML druggability scoring unavailable")
        _sklearn_available = False
    return _sklearn_available


FEATURE_NAMES = [
    "volume",
    "hydrophobic_ratio",
    "polar_ratio",
    "charged_ratio",
    "nearby_residue_count",
    "surface_accessibility",
    "cavity_points",
    "depth_score",
]


def _generate_training_data(n_samples: int = 2000, seed: int = 42):
    """Generate synthetic training data based on published druggability criteria."""
    rng = np.random.RandomState(seed)

    volumes = rng.uniform(50, 1500, n_samples)
    hydrophobic = rng.uniform(0.1, 0.9, n_samples)
    polar = rng.uniform(0.05, 0.6, n_samples)
    charged = rng.uniform(0.0, 0.4, n_samples)
    residue_count = rng.randint(5, 60, n_samples).astype(float)
    surface_acc = rng.uniform(0.1, 1.0, n_samples)
    cavity_pts = rng.randint(10, 500, n_samples).astype(float)
    depth = rng.uniform(1.0, 15.0, n_samples)

    # Normalize ratios so they sum to ~1
    total = hydrophobic + polar + charged
    hydrophobic /= total
    polar /= total
    charged /= total

    X = np.column_stack([
        volumes, hydrophobic, polar, charged,
        residue_count, surface_acc, cavity_pts, depth,
    ])

    # Druggability score formula inspired by published criteria:
    # - Larger, deeper, more hydrophobic pockets are more druggable
    # - Moderate polarity is acceptable; high charge is unfavorable
    score = (
        0.25 * np.clip(volumes / 800.0, 0, 1)
        + 0.25 * hydrophobic
        + 0.10 * np.clip(depth / 10.0, 0, 1)
        + 0.10 * np.clip(residue_count / 40.0, 0, 1)
        + 0.10 * np.clip(cavity_pts / 300.0, 0, 1)
        + 0.10 * (1.0 - charged)  # Lower charge is better
        + 0.05 * polar
        + 0.05 * (1.0 - surface_acc)  # Less exposed is better (buried pocket)
    )

    # Add realistic noise
    noise = rng.normal(0, 0.04, n_samples)
    score = np.clip(score + noise, 0.0, 1.0)

    return X, score


class DruggabilityPredictor:
    """ML-enhanced druggability prediction."""

    def __init__(self):
        self.model = None
        self.feature_importances = None
        self._trained = False

    def train(self):
        """Train the model on synthetic data."""
        if not _ensure_sklearn():
            logger.error("Cannot train: scikit-learn not available")
            return False

        try:
            X, y = _generate_training_data()
            self.model = _GradientBoostingRegressor(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.1,
                min_samples_split=10,
                min_samples_leaf=5,
                subsample=0.8,
                random_state=42,
            )
            self.model.fit(X, y)
            self.feature_importances = dict(
                zip(FEATURE_NAMES, self.model.feature_importances_.tolist())
            )
            self._trained = True
            logger.info("DruggabilityPredictor trained successfully")
            return True
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return False

    def _ensure_trained(self):
        if not self._trained:
            self.train()
        return self._trained

    def _extract_features(self, site: dict) -> dict:
        """Extract the 8 features from a binding site dict."""
        volume = float(site.get("volume", 0))
        hydro = float(site.get("hydrophobicity", 0) or site.get("hydrophobic_ratio", 0))
        polar = float(site.get("polar_ratio", 0))
        charged = float(site.get("charged_ratio", 0))

        # Derive polar/charged from amino acid composition if not provided
        nearby = site.get("nearby_residues", [])
        residue_count = float(len(nearby)) if nearby else float(site.get("nearby_residue_count", 10))

        if polar == 0 and charged == 0 and hydro > 0:
            polar = max(0, 1.0 - hydro - 0.1)
            charged = max(0, 1.0 - hydro - polar)

        surface_acc = float(site.get("surface_accessibility", 0.5))
        cavity_pts = float(site.get("cavity_points", volume / 3.0 if volume else 50))
        depth = float(site.get("depth_score", 0) or site.get("depth", 5.0))

        # Estimate depth from volume if not provided
        if depth == 0 and volume > 0:
            depth = min(volume / 100.0, 12.0)

        return {
            "volume": volume,
            "hydrophobic_ratio": hydro,
            "polar_ratio": polar,
            "charged_ratio": charged,
            "nearby_residue_count": residue_count,
            "surface_accessibility": surface_acc,
            "cavity_points": cavity_pts,
            "depth_score": depth,
        }

    def predict(self, binding_sites: list) -> list:
        """Score a list of binding sites. Returns predictions with feature analysis."""
        if not self._ensure_trained():
            return [{"error": "Model not available (scikit-learn not installed)"}
                    for _ in binding_sites]

        results = []
        for site in binding_sites:
            try:
                features = self._extract_features(site)
                feature_vector = np.array([[features[f] for f in FEATURE_NAMES]])
                score = float(self.model.predict(feature_vector)[0])
                score = max(0.0, min(1.0, score))

                # Individual tree predictions to estimate confidence
                tree_preds = np.array([
                    tree[0].predict(feature_vector)[0]
                    for tree in self.model.estimators_
                ])
                std = float(np.std(tree_preds))
                confidence = max(0.0, min(1.0, 1.0 - std * 3))

                original_score = float(
                    site.get("druggability_score", 0)
                    or site.get("druggability", 0)
                    or site.get("score", 0)
                )

                results.append({
                    "site_id": site.get("id") or site.get("pocket_id"),
                    "ml_druggability_score": round(score, 4),
                    "original_score": round(original_score, 4),
                    "confidence": round(confidence, 4),
                    "feature_values": {k: round(v, 4) for k, v in features.items()},
                    "feature_importance": self.feature_importances,
                })
            except Exception as e:
                logger.error(f"Prediction error for site: {e}")
                results.append({
                    "site_id": site.get("id") or site.get("pocket_id"),
                    "error": str(e),
                })

        return results


# Module-level singleton
_predictor = None


def get_predictor() -> DruggabilityPredictor:
    global _predictor
    if _predictor is None:
        _predictor = DruggabilityPredictor()
        _predictor.train()
    return _predictor
