"""
Literature and database search module for protein research context.

Queries three public APIs:
  1. PubMed (NCBI E-utilities) — recent papers mentioning the PDB ID or protein name
  2. UniProt — protein function, disease associations, organism
  3. RCSB PDB — structure metadata, bound ligands, resolution, experimental method
"""

import logging
from typing import Optional
import requests

logger = logging.getLogger(__name__)

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
UNIPROT_SEARCH_URL = "https://rest.uniprot.org/uniprotkb/search"
RCSB_GRAPHQL_URL = "https://data.rcsb.org/graphql"
RCSB_REST_URL = "https://data.rcsb.org/rest/v1/core/entry"

REQUEST_TIMEOUT = 15  # seconds


class LiteratureSearch:
    """Search PubMed, UniProt, and RCSB PDB for protein-related information."""

    def search_pubmed(self, pdb_id: str, protein_name: Optional[str] = None, max_results: int = 10) -> list:
        """Search PubMed for papers related to a PDB ID or protein name."""
        papers = []
        try:
            query = pdb_id
            if protein_name:
                query = f"{pdb_id} OR {protein_name}"

            # Step 1: Search for article IDs
            search_params = {
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "retmode": "json",
                "sort": "relevance",
            }

            search_resp = requests.get(PUBMED_SEARCH_URL, params=search_params, timeout=REQUEST_TIMEOUT)
            search_resp.raise_for_status()
            search_data = search_resp.json()

            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                logger.info(f"No PubMed results for query: {query}")
                return papers

            # Step 2: Fetch summaries
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "json",
            }
            fetch_resp = requests.get(PUBMED_FETCH_URL, params=fetch_params, timeout=REQUEST_TIMEOUT)
            fetch_resp.raise_for_status()
            fetch_data = fetch_resp.json()

            results = fetch_data.get("result", {})
            for pmid in id_list:
                article = results.get(pmid, {})
                if not article or "error" in article:
                    continue

                authors = article.get("authors", [])
                author_str = ", ".join(a.get("name", "") for a in authors[:3])
                if len(authors) > 3:
                    author_str += " et al."

                papers.append({
                    "pmid": pmid,
                    "title": article.get("title", ""),
                    "authors": author_str,
                    "journal": article.get("fulljournalname", article.get("source", "")),
                    "year": article.get("pubdate", "")[:4],
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                })

        except requests.RequestException as e:
            logger.error(f"PubMed search error: {e}")
        except Exception as e:
            logger.error(f"PubMed parsing error: {e}")

        return papers

    def search_uniprot(self, pdb_id: str) -> list:
        """Search UniProt for protein function and disease data linked to a PDB ID."""
        results = []
        try:
            params = {
                "query": f"(xref:pdb-{pdb_id.upper()})",
                "format": "json",
                "size": "5",
                "fields": "accession,protein_name,organism_name,gene_names,cc_function,cc_disease,cc_subcellular_location,length",
            }

            resp = requests.get(UNIPROT_SEARCH_URL, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()

            for entry in data.get("results", []):
                accession = entry.get("primaryAccession", "")

                # Extract protein name
                protein_desc = entry.get("proteinDescription", {})
                rec_name = protein_desc.get("recommendedName", {})
                protein_name = rec_name.get("fullName", {}).get("value", "Unknown")

                # Extract organism
                organism = entry.get("organism", {}).get("scientificName", "Unknown")

                # Extract function comments
                functions = []
                for comment in entry.get("comments", []):
                    if comment.get("commentType") == "FUNCTION":
                        for text in comment.get("texts", []):
                            functions.append(text.get("value", ""))

                # Extract disease associations
                diseases = []
                for comment in entry.get("comments", []):
                    if comment.get("commentType") == "DISEASE":
                        disease_obj = comment.get("disease", {})
                        if disease_obj:
                            diseases.append({
                                "name": disease_obj.get("diseaseId", ""),
                                "description": disease_obj.get("description", ""),
                            })

                # Extract subcellular location
                locations = []
                for comment in entry.get("comments", []):
                    if comment.get("commentType") == "SUBCELLULAR LOCATION":
                        for loc in comment.get("subcellularLocations", []):
                            location = loc.get("location", {}).get("value", "")
                            if location:
                                locations.append(location)

                # Gene names
                gene_names = []
                for gene in entry.get("genes", []):
                    name = gene.get("geneName", {}).get("value", "")
                    if name:
                        gene_names.append(name)

                results.append({
                    "accession": accession,
                    "protein_name": protein_name,
                    "organism": organism,
                    "gene_names": gene_names,
                    "functions": functions,
                    "diseases": diseases,
                    "subcellular_locations": locations,
                    "sequence_length": entry.get("sequence", {}).get("length", 0),
                    "url": f"https://www.uniprot.org/uniprot/{accession}",
                })

        except requests.RequestException as e:
            logger.error(f"UniProt search error: {e}")
        except Exception as e:
            logger.error(f"UniProt parsing error: {e}")

        return results

    def search_rcsb(self, pdb_id: str) -> dict:
        """Fetch structure metadata from RCSB PDB."""
        result = {}
        try:
            url = f"{RCSB_REST_URL}/{pdb_id.upper()}"
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()

            # Basic structure info
            struct = data.get("struct", {})
            result["title"] = struct.get("title", "")
            result["pdb_id"] = pdb_id.upper()

            # Citation info
            citation = data.get("rcsb_primary_citation", {})
            result["citation"] = {
                "title": citation.get("title", ""),
                "journal": citation.get("journal_abbrev", ""),
                "year": citation.get("year"),
                "authors": citation.get("rcsb_authors", []),
            }

            # Experimental method
            exptl = data.get("exptl", [{}])[0] if data.get("exptl") else {}
            result["experimental_method"] = exptl.get("method", "")

            # Resolution
            refine = data.get("refine", [{}])[0] if data.get("refine") else {}
            result["resolution"] = refine.get("ls_d_res_high")

            # Cell dimensions
            cell = data.get("cell", {})
            if cell:
                result["cell"] = {
                    "a": cell.get("length_a"),
                    "b": cell.get("length_b"),
                    "c": cell.get("length_c"),
                }

            # Entity info (polymer chains)
            entities = data.get("rcsb_entry_info", {})
            result["polymer_entity_count"] = entities.get("polymer_entity_count", 0)
            result["nonpolymer_entity_count"] = entities.get("nonpolymer_entity_count", 0)
            result["deposited_atom_count"] = entities.get("deposited_atom_count", 0)
            result["molecular_weight"] = entities.get("molecular_weight")

            # Deposit and release dates
            info = data.get("rcsb_accession_info", {})
            result["deposit_date"] = info.get("deposit_date", "")
            result["release_date"] = info.get("initial_release_date", "")

            result["url"] = f"https://www.rcsb.org/structure/{pdb_id.upper()}"

        except requests.RequestException as e:
            logger.error(f"RCSB search error: {e}")
            result["error"] = str(e)
        except Exception as e:
            logger.error(f"RCSB parsing error: {e}")
            result["error"] = str(e)

        return result

    def search_all(self, pdb_id: str, protein_name: Optional[str] = None) -> dict:
        """Run all three searches and return combined results."""
        pubmed = self.search_pubmed(pdb_id, protein_name)
        uniprot = self.search_uniprot(pdb_id)
        rcsb = self.search_rcsb(pdb_id)

        return {
            "pdb_id": pdb_id,
            "pubmed": pubmed,
            "uniprot": uniprot,
            "rcsb": rcsb,
            "total_papers": len(pubmed),
        }


# Module-level singleton
_searcher = None


def get_searcher() -> LiteratureSearch:
    global _searcher
    if _searcher is None:
        _searcher = LiteratureSearch()
    return _searcher
