"""Run the existing marker-driven selector; no pair extension is adopted."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c185-marker-causes'))
import importlib.util
p=Path(__file__).resolve().parent.parent/'c185-marker-causes/measure.py'
spec=importlib.util.spec_from_file_location('existing_marker_search',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
main=m.main
if __name__=='__main__':main()
